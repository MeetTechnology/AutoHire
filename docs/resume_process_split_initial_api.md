# 简历初次分析拆分：信息提取与资格判断接口说明

本文说明 `resume-process` 模块在保留原有「一次性初次分析」接口的前提下，新增的**两步异步流程**（仅提取 → 资格判断）及相关数据变更，供前端、调用方与运维配置使用。

> **契约事实源**：字段级 OpenAPI 以 `docs/openapi/swagger.yaml`（通过 `./scripts/openapi.ps1` 生成/校验）为准；本文侧重业务流程与集成要点。

---

## 1. 背景与变更摘要

### 1.1 未改动的能力

- **`POST /api/v1/resume-process/upload`**：行为与以前一致。仍入队 Asynq 任务 `resume:initial`，使用 prompt `RESUME_INITIAL`，一次完成「信息提取 + 资格判断」等原契约输出。
- 仍使用同一套 **Job、`GET /jobs/:jobId` 详情、SSE 订阅、Redis 进度频道、Asynq Worker**；未引入独立的查询体系。

### 1.2 新增能力

| 能力 | 说明 |
|------|------|
| 仅信息提取上传 | 新接口上传简历，只跑 11 项字段提取（prompt `RESUME_INITIAL_EXTRACT`），**不**做资格判断。 |
| 资格判断接续 | 基于同一 `job_id` 已落库的提取文本，触发资格判断（prompt `RESUME_INITIAL_ELIGIBILITY`），**不**重新上传或读取简历文件。 |

### 1.3 数据与 Prompt

- 表 **`resume_initial_results`** 扩展字段：`extraction_*`、`judgment_*`，与原有 `raw_response`、`parsed_result`、`status`、`error_message` 并存。
- 迁移 **`000099_split_resume_initial_extraction_judgment`**：为生产库 seed 两个新 prompt 类型（并可在 `prompts` 表中维护版本）。
- 后台任务类型：`resume:extract`、`resume:judge_eligibility`（需在 Worker 中已注册，与现有 `resume:initial` 并列）。

---

## 2. 何时用旧接口 vs 新接口

| 场景 | 建议 |
|------|------|
| 与历史前端/调用方兼容、一次拿到完整初次分析结果 | 继续使用 **`POST .../upload`**（`RESUME_INITIAL`）。 |
| 需要先展示提取结果、再由用户或系统决定何时做资格判断 | 使用 **`POST .../extraction/upload`** → 轮询/SSE 等待提取完成 → **`POST .../jobs/:jobId/judge-eligibility`**。 |

**与二次生成的关系**：`POST .../jobs/:jobId/trigger-secondary` 仍要求 **`job.status == completed`** 且 **`initial_result.status == completed`**。拆分流程下，提取阶段结束会把 job 标为 `completed` 且 `initial_result.status` 为 `completed`，从技术上可能满足触发条件，但此时 `raw_response` 仅为提取段；若二次生成提示词依赖「完整三段式初次分析」正文，**业务上建议在资格判断完成后再触发二次生成**，使 `raw_response` 与旧版一次性上传对齐。

---

## 3. 接口说明

**路由前缀**：`/api/v1/resume-process`  
**认证**：以下两个新接口均走 **Bearer JWT**（`Authorization: Bearer <token>`），与现有 `upload` 一致。

### 3.1 上传简历并仅做信息提取

- **URL**：`POST /api/v1/resume-process/extraction/upload`
- **Content-Type**：`multipart/form-data`
- **表单字段**
  - **`files`**：可选，多文件（可重复字段名）。
  - **`file`**：可选，单文件（与 `files` 二选一或组合均可，后端会合并为文件列表）。
- **约束**
  - 至少一个文件；扩展名仅 **`.pdf` / `.docx` / `.doc`**（按文件名后缀校验）。
  - Multipart 解析体积上限 **32 MiB**（与现有上传实现一致）。
- **成功响应**：`202 Accepted`

```json
{
  "message": "resume extraction job accepted",
  "job_id": 123,
  "files_count": 1
}
```

- **行为概要**
  1. 写入磁盘、`files` 表、`resume_process_jobs`、`resume_initial_results`（与原有上传共用事务与失败补偿逻辑）。
  2. 入队 **`resume:extract`**，由 Worker 执行文档多模态调用（Office→PDF、Gemini、重试与 Docling 回退等与初次分析链路复用）。

常见 **4xx/5xx** 与原有上传类似，错误体为统一结构（见下文「错误响应」）；例如缺少文件、扩展名不支持会返回 `400`，`code` 如 `missing_files`、`unsupported_file_type`。

---

### 3.2 基于已有 Job 触发资格判断

- **URL**：`POST /api/v1/resume-process/jobs/:jobId/judge-eligibility`
- **Path 参数**：`jobId`（无符号整数，非法则 `400`，`code: invalid_job_id`）。
- **Body**：无。
- **前置条件**
  - Job 必须属于当前用户；不存在或不属于当前用户时 **`404`**（与模块既有 job 可见性一致）。
  - **`initial_result.extraction_status == completed`** 且 **`extraction_raw_response` 非空**；否则 **`409 Conflict`**，`code: extraction_not_completed`，`stage: judgment`。
- **成功响应**：`202 Accepted`

```json
{
  "message": "eligibility judgment accepted",
  "job_id": 123
}
```

- **行为概要**
  1. 将 job 与 `judgment_*` 置为进行中并发 SSE。
  2. 入队 **`resume:judge_eligibility`**。
  3. Worker 仅将 **`extraction_raw_response`** 作为文本输入调用 **`RESUME_INITIAL_ELIGIBILITY`**，生成**完整三段式**输出（与旧版初次分析最终正文契约一致），并写回数据库（见下一节）。

---

## 4. 查询结果：`GET /api/v1/resume-process/jobs/:jobId`

在拆分流程下，`initial_result` 除原有字段外，会包含**分阶段字段**（JSON 字段名以实际 API 与 swagger 为准）：

| 字段（逻辑含义） | 提取完成后 | 资格判断完成后 |
|------------------|------------|----------------|
| `extraction_raw_response` / `extraction_parsed_result` / `extraction_status` / `extraction_error_message` | 提取输出与状态 | **保留**，不被判断阶段覆盖 |
| `judgment_raw_response` / `judgment_parsed_result` / `judgment_status` / `judgment_error_message` | 多为 `pending` 或未开始 | 判断输出与状态 |
| **`raw_response` / `parsed_result` / `status`**（兼容列） | 与提取结果一致，便于沿用「读 `raw_response`」的客户端 | 更新为**完整三段**最终结果，便于与旧版 `RESUME_INITIAL` 解析逻辑对齐 |

**旧接口 `POST /upload`（`resume:initial`）**：仍主要写入兼容列；`extraction_*` / `judgment_*` 可能保持默认未用状态，调用方若无拆分需求可继续只读 `raw_response`。

---

## 5. SSE 与进度订阅

- **URL**：`GET /api/v1/resume-process/subscribe/:jobId?token=<JWT>`（query token，与现有一致）。
- **Redis 频道**：`resume-process:job:{jobId}`（与现有一致）。

拆分流程下，推送 JSON 中的 **`stage`** 会区分阶段，便于前端区分 UI：

| `stage` 取值（示例） | 含义 |
|----------------------|------|
| `upload` | 上传相关错误（部分错误场景） |
| `extraction` | 信息提取进行中/完成/失败 |
| `judgment` | 资格判断进行中/完成/失败 |
| `initial` | 仍为原「一次性初次分析」任务使用 |

载荷结构与现有 `ResumeProcessUpdatePayload` 一致，包含 `job_id`、`stage`、`status`、`message`、`job_status`、`retryable`、`retry_after` 等。具体字段以运行时消息为准；**终端态**仍以 `status` 为 `completed` / `failed` 等时关闭连接的逻辑为准（参见 `docs/resume_process_api.md` 中 SSE 小节）。

---

## 6. 错误响应格式（通用）

失败时响应体一般为：

```json
{
  "code": "extraction_not_completed",
  "stage": "judgment",
  "message": "信息提取尚未完成，无法触发资格判断",
  "retryable": false
}
```

资格判断接口在提取未就绪时：**HTTP 409**，`code` 为 **`extraction_not_completed`**。其他 HTTP 状态与 `code` 与模块内既有约定一致（401 未认证、404 任务不存在或无权限等）。

---

## 7. 集成 checklist（必要前置）

1. **数据库迁移**：已执行含 `000099` 的迁移，`resume_initial_results` 新列存在；`prompts` 中已有 **`RESUME_INITIAL_EXTRACT`**、**`RESUME_INITIAL_ELIGIBILITY`** 的生产可用版本。
2. **Asynq Worker**：进程已注册并消费 **`resume:extract`**、**`resume:judge_eligibility`**（与 `resume:initial` 同模块 worker）。
3. **调用顺序**：先 **`extraction/upload`** 拿 `job_id` → SSE 或轮询 **`GET .../jobs/:jobId`** 直至 **`extraction_status == completed`** → 再 **`judge-eligibility`**。
4. **解析结果**：资格判断完成后，若需与旧版初次分析一致，请读 **`initial_result.raw_response`**（完整三段）；若仅需提取段，读 **`extraction_raw_response`**。
5. **AutoHire 前端/BFF 上线顺序**：先部署 resume-process 迁移与 Worker，再部署 AutoHire 的本地迁移（新增提取确认状态与持久化表）和代码。若 split 接口在生产验证中不可用，可临时回退到旧 `POST .../upload` 一次性初次分析路径，已上传到 AutoHire 对象存储的简历不需要重新上传。

---

## 8. 相关文件索引（便于代码阅读）

| 说明 | 路径 |
|------|------|
| Handler：上传提取、触发判断 | `internal/handlers/resume_process_handler.go` |
| Service：提取/判断逻辑 | `internal/core/services/resume_process_split_initial.go` |
| Worker 入口 | `internal/core/workers/resume_process_worker.go`、`internal/core/workers/server.go` |
| 任务类型与入队载荷 | `internal/core/workers/tasks.go` |
| 数据模型 | `internal/core/models/resume_process.go` |
| Prompt 与表结构迁移 | `internal/database/migrations/000099_split_resume_initial_extraction_judgment.up.sql` |

---

## 9. 版本说明

文档描述与当前仓库实现一致；若接口或字段有变更，请以 OpenAPI 生成物与迁移版本为准并更新本文档。
