# 专家端（AutoHire）与 GO_EIIE 简历重分析联调说明

本文档说明在采用 **规格选项 A（上游登记映射）** 时，专家端 BFF 相对 [resume-reanalysis-backend-spec.md](./resume-reanalysis-backend-spec.md) 需要**额外完成**的集成步骤。规格中的 `POST …/jobs/{jobId}/reanalyze` 请求体、鉴权、成功/错误 JSON 形态仍以规格文档为准。

## 1. 背景：为何需要映射

规格 [第 2.1 节](./resume-reanalysis-backend-spec.md) 指出：URL 中的 `{jobId}` 当前为专家库 **`ResumeAnalysisJob.id`（cuid）**，而本服务 `resume_process` 的父任务主键为 **自增数值 `job_id`**。本仓库在 `reanalyze` 中支持：

- **数值路径**：`jobId` 为十进制字符串且与 `latestAnalysisJobId` 一致时，直接作为本服务父 `job_id`（便于联调）。
- **cuid 路径**：与 `latestAnalysisJobId` 相同的 cuid 时，必须先通过 **`POST …/mappings`** 登记映射，否则返回 **404** `mapping_not_found`。

路径 `jobId` 与 body `latestAnalysisJobId` **必须一致**（与规格「同源」一致），否则 **400** `job_id_mismatch`。

## 2. 环境变量（与规格一致部分）

| 变量 | 说明 |
|------|------|
| `RESUME_ANALYSIS_BASE_URL` | 上游 API 根，例如 `https://go-eiie.example.com` 或已含前缀的网关地址 |
| `RESUME_ANALYSIS_API_KEY` | 与本服务 `.env` / `resume_analysis.api_key` **完全一致**的静态密钥 |
| `RESUME_ANALYSIS_REANALYZE_PATH` | 默认 `/internal/resume-analysis/jobs/{jobId}/reanalyze`，`{jobId}` 替换为 `encodeURIComponent(latestAnalysisJobId)` |
| `RESUME_ANALYSIS_MAPPINGS_PATH` | 默认 `/internal/resume-analysis/mappings`；若网关路径为 `POST /api/v1/internal/...`，可设为 `/api/v1/internal/resume-analysis/mappings`（与 `BASE_URL` 拼接规则同 upload） |

专家端在 **live** 下会在适当时机自动 `POST` 该路径登记映射（见第 3 节与仓库 `syncExpertJobUpstreamMapping`）。

鉴权：`Authorization: Bearer <RESUME_ANALYSIS_API_KEY>`（规格 2.2）。

若本服务未配置 `RESUME_ANALYSIS_API_KEY`，重分析与映射接口均返回 **503** `service_unavailable`。

## 3. 专家端必须新增的调用：登记映射

在专家调用 **`reanalyze` 之前**（至少早于用户首次可能触发「补填后重分析」），BFF 必须已成功调用一次映射登记。

### 3.1 端点（二选一，与现有路由风格一致）

- `POST {BASE}/internal/resume-analysis/mappings`
- `POST {BASE}/api/v1/internal/resume-analysis/mappings`

其中 `{BASE}` 与现有 `upload`、`GET job` 使用的 `RESUME_ANALYSIS_BASE_URL` 约定一致（若 BASE 已含 `/api/v1`，请拼出完整 URL，避免双前缀）。

### 3.2 请求

- **Headers**：`Authorization: Bearer …`，`Content-Type: application/json`
- **Body JSON**：

```json
{
  "applicationId": "<专家端申请主键>",
  "expertAnalysisJobId": "<与 ResumeAnalysisJob.id / URL jobId / latestAnalysisJobId 相同的 cuid>",
  "upstreamJobId": <本服务 POST /api/v1/resume-process/upload 返回的 job_id 数值>
}
```

### 3.3 前置条件（本服务校验）

- `upstreamJobId` 对应的 `ResumeProcessJob` 存在，且 **初次分析已完成**（`job.status=completed` 且 `ResumeInitialResult` 已完成）。否则返回 **404** / **409** 等（见 OpenAPI 或实际响应 `code`）。

### 3.4 响应与幂等

- **201**：首次创建映射。
- **200**：同一 `(applicationId, expertAnalysisJobId)` 重复提交且 `upstreamJobId` 相同，幂等返回。
- **409** `mapping_conflict`：同一专家任务已绑定**不同**的 `upstreamJobId`。

### 3.5 推荐调用时机

在专家端「已拿到本服务上传返回的 `job_id` / `externalJobId`」且「已创建/可稳定获得 `ResumeAnalysisJob.id`（cuid）」之后，**尽快**调用登记（可与写 `externalJobId` 同事务或紧接其后），避免用户在映射写入前点击重分析。

## 4. 重分析调用（与规格一致 + 本服务约束）

在映射已存在（或使用数值同源路径）后，继续按规格调用：

`POST {BASE}{RESUME_ANALYSIS_REANALYZE_PATH}`  

Body：`applicationId`、`latestAnalysisJobId`、`fields`（规格 2.3）。

成功仍为 **202**，且包含 `externalJobId` / `job_id` 与 `status`/`jobStatus`（规格第 3 节）。

随后与首次分析相同，使用 **`GET {BASE}/api/v1/resume-process/jobs/{新 job_id}`** 轮询（若 BASE 不含 `/api/v1`，请自行拼出完整路径；规格附录与现有专家端轮询逻辑一致）。

## 5. 错误码速查（专家 BFF 可记录）

| HTTP | code（示例） | 场景 |
|------|----------------|------|
| 503 | `service_unavailable` | 上游未配置 `resume_analysis.api_key` |
| 401 | `unauthorized` | Bearer 缺失或密钥错误 |
| 400 | `invalid_json` / `invalid_body` / `job_id_mismatch` | JSON、字段或路径与 body 的 job id 不一致 |
| 404 | `mapping_not_found` | cuid 路径但未登记映射 |
| 404 | `upstream_job_not_found` | 登记时 `upstreamJobId` 不存在 |
| 409 | `mapping_conflict` | 同一专家任务绑定不同上游 id |
| 409 | `parent_not_completed` 等 | 父任务或上游初次结果未就绪（重分析） |

## 6. 与规格第 8 节 R1 的对应关系

| 规格项 | 本仓库做法 |
|--------|------------|
| R1：URL 为 cuid 与数值 `job_id` 不一致 | 通过 **`POST …/mappings`** 在本服务侧建立映射，专家端 **无需** 把 URL 改为数值型 `job_id`（选项 A）。 |

若后续改为专家端 URL 直接传数值 `job_id`，可省略映射调用，但仍需保证路径 `jobId` 与 body `latestAnalysisJobId` **字符串一致**。

## 7. 参考

- [resume-reanalysis-backend-spec.md](./resume-reanalysis-backend-spec.md)
- 仓库内 OpenAPI：`./scripts/openapi.ps1` 生成，标签 `internal-resume-analysis`
