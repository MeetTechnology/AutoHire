# 简历「补填后重分析」上游接口 — 后端实现规格说明

本文档面向**简历分析上游 / 内部网关**的后端开发（含 AI 辅助实现场景），说明专家端（AutoHire）在 **live** 模式下对「补全缺失字段后再次分析」的调用方式、契约与推荐行为。实现本接口后，与 `RESUME_ANALYSIS_MODE=live` 及现有轮询、结果拉取逻辑即可闭环。

相关仓库内参考：

- 客户端适配：`src/lib/resume-analysis/client.ts`（`reanalyzeWithSupplementalFields`）
- 业务编排：`src/lib/application/service.ts`（`submitSupplementalFields`）
- 产品契约摘要：`docs/04_API_Contracts.md` 第 7、13 节
- 首次分析流水线说明：`docs/resume-process-api.md`（若与 `resume-process` 同栈，可复用任务模型与 LLM 输出约定）

---

## 1. 背景与目标

1. 专家完成简历上传后，初次分析可能返回「信息不足」状态；专家在页面补全结构化字段后点击 **Submit and Reanalyze**。
2. 专家端将补充字段落库，并调用本规格所述的 **重分析接口**，创建一条新的上游异步任务（或同步完成）。
3. 专家端把响应中的 **`externalJobId` / `job_id`** 写入新的分析任务记录，随后与首次分析相同：通过 **`GET …/resume-process/jobs/{jobId}`** 轮询 `job.status` 与 `initial_result`，直至可解析最终结果。

**目标**：新增的后端能力应至少满足：鉴权、幂等与审计、可异步返回任务 ID、产出与初次分析一致的 **`initial_result` 形态**（以便专家端现有 normalizer 无需分叉逻辑）。

---

## 2. 专家端实际发起的 HTTP 调用

### 2.1 方法与 URL

| 项目 | 说明 |
|------|------|
| **Method** | `POST` |
| **完整 URL** | `{RESUME_ANALYSIS_BASE_URL}` + 路径模板替换后的路径 |
| **路径模板（环境变量）** | `RESUME_ANALYSIS_REANALYZE_PATH`，默认：`/internal/resume-analysis/jobs/{jobId}/reanalyze` |
| **路径参数 `{jobId}`** | 由专家端将模板中的 `{jobId}` 替换为 **`encodeURIComponent(latestAnalysisJobId)`** 后的字符串 |

> **重要（集成风险）**：当前专家端传入的 `latestAnalysisJobId` 为 **PostgreSQL 表 `ResumeAnalysisJob` 的主键 `id`（cuid）**，即专家端内部任务 ID，**不是** `resume-process` 上传接口返回的数值型 `job_id`。若新服务直接拿该值去查 `resume_process` 库表会失败。  
> **实现方必选其一**：  
> - **A. 网关层**：根据专家端任务 ID 解析出历史上绑定的上游 `job_id` / `external_job_id`，再转调真正的流水线；或  
> - **B. 协调改专家端**：将 URL / 请求体改为传递上游 `job_id`（见第 8 节「与专家端的协调项」）。

### 2.2 鉴权与超时

| 项目 | 说明 |
|------|------|
| **请求头** | `Authorization: Bearer <RESUME_ANALYSIS_API_KEY>`（与首次 `upload`、轮询 `GET job` 一致） |
| **Content-Type** | `application/json` |
| **客户端超时** | 当前专家端单次请求约 **15 秒**（超时则视为可重试类失败，业务上可能重试状态轮询，但**不会自动重放**整次补提交流） |

因此：**重分析接口应在超时前返回**（推荐 **202 + 任务已入队**，或极快完成时 **200 + completed**），**不要**在单次 HTTP 请求内阻塞到 LLM 全流程结束（除非能保证远小于 15s）。

### 2.3 请求体 JSON

专家端发送的 body 结构固定为：

```json
{
  "applicationId": "<专家端申请主键，字符串>",
  "latestAnalysisJobId": "<与 URL 中 {jobId} 相同，当前为专家端 ResumeAnalysisJob.id>",
  "fields": { "<键>": "<值>", "...": "..." }
}
```

**`fields` 的键语义**（当前实现）：

- 专家端优先发送 **`valuesBySourceItemName`**：键为「模型/缺失项里的 **source item 名称**」（如中文「最高学位」「当前工作单位」），值为用户填写内容；若未构建该映射则回退为 **`valuesByFieldKey`**（如 `highest_degree`、`current_employer`）。
- 值类型多为字符串；可能含日期、`select`/`radio` 选项、以及「其他」学历时的附加字段等。

上游可实现为：

- 同时接受 **fieldKey** 与 **sourceItemName** 两套键（推荐做别名表归一化到内部 canonical 字段），或  
- 仅消费其中一种并在文档中写明（需与专家端约定一致）。

---

## 3. 成功响应：专家端可解析的 JSON 形态

专家端使用 Zod 对成功响应做宽松校验（`.passthrough()`），**必须**满足以下约束，否则专家端会报「缺少 external job id」或「未知状态」类错误。

### 3.1 任务标识（必填其一，推荐同时返回）

| 字段 | 类型 | 说明 |
|------|------|------|
| `externalJobId` | string | 上游全局唯一任务 ID（专家端优先使用） |
| `job_id` | number 或十进制数字字符串 | 与 `resume-process` 的 `job_id` 一致时可与 `externalJobId` 等价；专家端会 `String(job_id)` 作为 fallback |

二者至少其一非空；专家端合并规则：`externalJobId ?? String(job_id)`。

### 3.2 任务状态（必填其一）

| 字段 | 类型 | 说明 |
|------|------|------|
| `jobStatus` | string | 与下互斥可选 |
| `status` | string | 与上互斥可选 |

专家端将状态字符串 **trim + 小写** 后映射为：

| 上游取值（示例） | 专家端内部 |
|------------------|------------|
| `pending`, `queued` | `queued` |
| `processing`, `retrying` | `processing` |
| `completed` | `completed` |
| `failed` | `failed` |

**其他任何字符串**都会导致专家端抛出「Unknown upstream job status」（502 类失败）。因此请严格使用上表枚举或扩展时先与专家端同步白名单。

### 3.3 可选文案与错误

| 字段 | 类型 | 说明 |
|------|------|------|
| `stageText` / `stage_text` | string \| null | 阶段说明（专家端写入 `ResumeAnalysisJob.stageText`） |
| `errorMessage` / `error_message` | string \| null | 失败或部分失败时的可读说明 |

允许附加任意其它字段（passthrough），便于调试或网关扩展。

### 3.4 推荐 HTTP 状态码

| 场景 | 建议 |
|------|------|
| 已入队、异步执行 | **202 Accepted**，body 中带 `job_id`/`externalJobId` 与 `status: queued`（或 `processing`） |
| 同步完成（仅适用于极快路径或测试） | **200 OK**，`status: completed`，且后续 `GET …/jobs/{id}` 已能读到完整 `initial_result` |
| 参数非法、无法解析任务 | **400**，body 建议符合第 4 节错误结构 |

---

## 4. 错误响应（与专家端 `upstreamErrorSchema` 对齐）

当 HTTP 状态 **非 2xx** 时，专家端会尝试将 body 解析为：

```json
{
  "code": "string, optional",
  "stage": "string, optional",
  "message": "string, optional",
  "retryable": "boolean, optional",
  "retry_after": "number, optional"
}
```

行为要点：

- **`message`**：会作为专家端对用户/日志展示的主要文案来源之一。
- **`retryable`**：若为 true，或 HTTP 为 **429 / 5xx**，专家端状态同步会按「可重试」处理（不一定立刻把申请标为失败）。
- **`retry_after`**：秒数；当前专家端主要依赖 HTTP 层重试语义，可预留。

---

## 5. 与首次分析流水线的一致性要求

补填重分析完成后，专家端仍通过 **`GET {BASE_URL}/resume-process/jobs/{externalJobId}`**（见 `fetchJobDetail`）拉取 **`job` + `initial_result`**，并用与首次相同的规则解析资格、摘要、抽取字段与缺失项。

因此新任务应满足：

1. **新 `job_id`**：重分析应产生 **新的** `ResumeProcessJob`（或等价实体），专家端用返回的 ID 轮询；**不要**复用旧 ID 却破坏「一次任务一次结果」的语义，除非专家端整体改造为「同 job 多版本结果」。
2. **`initial_result`**：与 `docs/resume-process-api.md` 描述一致，至少包含可被专家端 adapter 消费的字段，例如：
   - `raw_response`（含 `[[[...]]]` / `{{{...}}}` / `!!!...!!!` 等约定标记时，与现有 normalizer 一致）
   - `parsed_result`（若专家端优先消费 JSON 而非纯文本，需与现网首次分析一致）
   - `status`、`error_message` 等与现网轮询逻辑兼容
3. **业务语义**：将 **`fields`** 与初次上传的简历内容、以及（若可取得）初次 `initial_result` 的抽取结果合并，再跑 **同类型** 资格判断提示词（如 `RESUME_INITIAL`），输出仍应可被专家端映射为 `ELIGIBLE` / `INELIGIBLE` / `INSUFFICIENT_INFO` 等等价物。

---

## 6. 建议的服务端功能清单

### 6.1 核心接口

- [ ] 实现 `POST …/jobs/{jobId}/reanalyze`（或环境变量配置的等价路径）
- [ ] 校验 Bearer Token
- [ ] 校验 JSON body：`applicationId`、`latestAnalysisJobId`、`fields`
- [ ] **解析 `{jobId}` / `latestAnalysisJobId` → 原始简历任务**（见第 2.1 节，避免直接当 `resume_process.job.id` 使用）
- [ ] 将 `fields` 归一化为内部结构化上下文（与缺失项 `source_item_name` / `field_key` 对齐）
- [ ] 创建异步任务（推荐 Asynq / 队列），持久化：上游 job 行、与专家端 `applicationId` 的关联（若需回调或审计）
- [ ] 返回符合第 3 节的 JSON

### 6.2 与现有 `resume-process` 的集成方式（推荐架构）

| 模块 | 职责 |
|------|------|
| **Reanalyze API** | 鉴权、校验、解析专家端 job id、合并字段、创建 **新** `ResumeProcessJob` 或挂载子任务 |
| **Worker** | 读原文件、拼 prompt、写 `ResumeInitialResult`、更新 job `status` |
| **存储** | 仍能访问初次上传的源文件（与首次 `ResumeInitial` 任务相同来源） |

若 `reanalyze` 与 `resume-process` **部署在同一服务**：可复用 `POST /resume-process/upload` 之后的同一套表结构与轮询接口，仅入口不同。

### 6.3 非功能需求

- **幂等**：同一专家端在短时间内重复提交（网络重试）时，建议基于 `(applicationId, supplementalSubmissionId)` 或请求指纹去重，避免重复扣费/重复任务；至少保证重复请求返回**同一新 job** 或明确错误码。
- **审计**：记录 `applicationId`、专家端 `latestAnalysisJobId`、上游新 `job_id`、补填字段快照 ID、耗时与模型版本。
- **权限**：Token 仅服务专家端 BFF，不应对公网匿名开放。
- **限流**：按 `applicationId` 或 IP 限制重分析频率，防止滥用。

---

## 7. 测试验收清单（供联调）

1. **鉴权**：无 Token / 错误 Token → 401，body 可带 `message`。
2. **非法 body**：缺 `fields` 或空对象 → 400。
3. **成功入队**：返回 202，JSON 含 `job_id` 或 `externalJobId`，`status` 为 `queued` 或 `processing`。
4. **轮询**：用返回的 ID 调用 `GET /resume-process/jobs/{job_id}`，直至 `job.status=completed` 且 `initial_result` 可读。
5. **专家端全链路**：配置 `RESUME_ANALYSIS_*` 后，从 `INFO_REQUIRED` 补填提交 → 申请进入 `REANALYZING` → 最终变为 `ELIGIBLE` / `INELIGIBLE` / 再次 `INFO_REQUIRED` 之一，且 `analysis-result` 与页面展示一致。
6. **超时**：接口在 15s 内返回（队列已接受即可）。
7. **错误状态**：上游 `failed` 时，专家端应能展示失败文案并停止错误轮询（与现网首次失败行为一致）。

---

## 8. 与专家端（AutoHire）的协调项（建议产品/架构确认）

以下问题不影响你方先实现「独立可用的重分析服务」，但影响 **零改造联调**：

| 编号 | 问题 | 建议 |
|------|------|------|
| R1 | URL 中 `{jobId}` 当前为专家端 `ResumeAnalysisJob.id`（cuid），与 `resume-process` 数值 `job_id` 不一致 | 网关映射专家端 ID → 上游 `job_id`；或专家端改为在路径中使用 `externalJobId` |
| R2 | 请求体 `latestAnalysisJobId` 与 URL 重复且语义相同 | 可保留；若改为只传上游 ID，需同步修改 `src/lib/application/service.ts` 与 `client.ts` |
| R3 | `fields` 键为中文 `sourceItemName` 或英文 `fieldKey` | 上游做双向别名映射，或与专家端约定只传一种 |

若你方仅实现 **`resume-process` 原生路径**（例如 `POST /api/v1/resume-process/jobs/:jobId/reanalyze`），请将专家端环境变量 **`RESUME_ANALYSIS_REANALYZE_PATH`** 配置为带 `{jobId}` 的模板，且 **保证占位符替换后的 id 与模板语义一致**。

---

## 9. 附录：专家端调用链摘要（便于对照日志）

1. 用户提交 → `POST /api/applications/{applicationId}/supplemental-fields`（专家端自有 API）
2. 服务端 → `POST {BASE_URL}{reanalyzePath}`，Bearer + JSON body（本章规格）
3. 成功后专家端写入新 `ResumeAnalysisJob`（`jobType=REANALYSIS`），`externalJobId` = 响应中的 id
4. 轮询 → `GET {BASE_URL}/resume-process/jobs/{externalJobId}`，直至得到可消费的 `initial_result`
5. 专家端解析结果 → 更新 `application_status`、写入新 `ResumeAnalysisResult`

---

*文档版本：与仓库 2026-04 代码行为对齐；若专家端后续修改 `latestAnalysisJobId` 语义，请同步更新本节与 `docs/04_API_Contracts.md`。*
