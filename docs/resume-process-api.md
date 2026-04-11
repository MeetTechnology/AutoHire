# 简历处理模块（`resume-process`）API 说明

本文档基于仓库当前代码（路由：`api/router.go`；处理器：`internal/handlers/resume_process_handler.go`；业务：`internal/core/services/resume_process_service.go`；模型：`internal/core/models/resume_process.go`）整理，描述 **简历处理流水线** 对外 HTTP 接口、鉴权方式、请求与响应形态及核心字段含义。

> **范围说明**：路由前缀为 `/api/v1/resume-process` 的一组接口即本文所述「简历处理模块」。同仓库另有「外部简历生成」`/external-resumes`、「专家简历分析」`/expert-resumes` 等能力，属于不同业务分组，不在此展开。

---

## 1. 服务端口与基础路径

| 项目 | 说明 |
|------|------|
| **HTTP 端口** | 由配置项 `server.port` 决定。仓库默认骨架见 `config/config.yaml`（示例值 `8079`）；部署时通常通过环境变量或 `.env` 覆盖，最终以运行时 `config.AppConfig.Server.Port` 为准。 |
| **监听方式** | `cmd/main.go` 中 `router.Run(":" + listenPort)`，即监听 `0.0.0.0:<port>`。 |
| **API 前缀** | 全局分组为 `/api/v1`（见 `api/router.go`）。 |
| **本模块完整前缀** | `/api/v1/resume-process` |

**示例根地址**（默认端口时）：

- `http://<host>:8079/api/v1/resume-process/...`

OpenAPI 注解中的 `@BasePath` 为 `/api/v1`（见 `cmd/main.go` 顶部注释）。

---

## 2. 模块职责概览

1. **上传**：用户上传一份或多份简历文件（PDF / DOC / DOCX），创建 `ResumeProcessJob` 并入队 **初次分析**（Asynq 任务 `ResumeInitial`）。
2. **初次分析**：后台读取源文件（Office 会转 PDF），使用提示词类型 `RESUME_INITIAL` 调用 LLM，将结果写入 `ResumeInitialResult`（含 `raw_response` 与可选 `parsed_result`）。
3. **二次生成**：初次任务成功后，用户可调用触发接口创建 `ResumeSecondaryRun`，按配置的多个提示词并行生成 `ResumeSecondaryResult`。
4. **导出**：按任务（及可选批次 `run_id`）导出 Excel 模板（`application/vnd.ms-excel`）。
5. **实时进度**：通过 **Server-Sent Events (SSE)** 订阅 Redis 频道 `resume-process:job:<jobId>` 上的 JSON 进度推送。

---

## 3. 鉴权方式

| 接口类型 | 鉴权 |
|----------|------|
| 除 SSE 外的本组接口 | **Bearer JWT**：请求头 `Authorization: Bearer <token>`（与其它受保护路由一致）。未登录时返回结构化错误（`code: unauthorized`，HTTP 401）。 |
| `GET /resume-process/subscribe/:jobId` | **Query JWT**：查询参数 `token=<JWT>`，**不使用** Bearer 中间件，便于浏览器 `EventSource`（无法自定义 Header）连接。 |

---

## 4. 接口一览

以下路径均相对于 `/api/v1`。

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/resume-process/upload` | 上传简历文件，创建任务并入队初次分析 |
| GET | `/resume-process/jobs` | 分页列出当前用户的任务 |
| GET | `/resume-process/jobs/:jobId` | 任务详情（含初次结果、可选二次批次与结果） |
| DELETE | `/resume-process/jobs/:jobId` | 软删除任务 |
| GET | `/resume-process/subscribe/:jobId` | SSE 订阅任务进度；已终态时返回 JSON 快照 |
| POST | `/resume-process/jobs/:jobId/trigger-secondary` | 触发二次生成 |
| GET | `/resume-process/jobs/:jobId/secondary-results` | 查询二次生成结果列表 |
| GET | `/resume-process/jobs/:jobId/export-template` | 下载 Excel 模板文件 |

---

## 5. 各接口详细说明

### 5.1 `POST /resume-process/upload`

**Content-Type**：`multipart/form-data`

**表单字段**：

| 字段名 | 必填 | 说明 |
|--------|------|------|
| `files` | 与 `file` 二选一 | 多文件；可重复同一字段名上传多个文件 |
| `file` | 与 `files` 二选一 | 单文件兼容字段 |

**文件限制**：

- 扩展名：`.pdf`、`.docx`、`.doc`（大小写不敏感）
- 服务端单次解析 multipart 上限约 **32 MiB**（`ParseMultipartForm(32 << 20)`）

**成功响应**：HTTP **202 Accepted**，JSON：

| 字段 | 类型 | 含义 |
|------|------|------|
| `message` | string | 固定语义提示，如 `resume process job accepted` |
| `job_id` | uint | 新建任务主键 ID |
| `files_count` | int | 成功关联的源文件数量 |

**错误响应**：HTTP 400 / 401 / 500 等，JSON 结构见 [第 8 节](#8-错误响应结构-resume-process-专用)。

---

### 5.2 `GET /resume-process/jobs`

**Query 参数**：

| 参数 | 类型 | 默认 | 约束 | 含义 |
|------|------|------|------|------|
| `limit` | int | 20 | 1～100 | 每页条数 |
| `offset` | int | 0 | ≥0 | 偏移量 |

**成功响应**：HTTP **200**，JSON：

| 字段 | 类型 | 含义 |
|------|------|------|
| `total` | int64 | 当前用户任务总数 |
| `items` | `ResumeProcessJob[]` | 任务列表，按 `id` 降序 |

`items` 中单条结构见 [第 7.1 节](#71-resumeprocessjob)。

---

### 5.3 `GET /resume-process/jobs/:jobId`

**Query 参数**：

| 参数 | 必填 | 含义 |
|------|------|------|
| `run_id` | 否 | 指定二次生成批次 ID；**省略时取该任务下 ID 最大的批次**（若不存在批次则二次相关字段为空） |

**成功响应**：HTTP **200**，JSON 为 `ResumeProcessJobDetail`：

| 字段 | 类型 | 含义 |
|------|------|------|
| `job` | object | 任务主记录 |
| `initial_result` | object 或省略 | 初次分析结果；可能尚未落库完成时为 processing |
| `secondary_run` | object 或省略 | 当前解析到的二次批次（见上表 `run_id` 规则） |
| `secondary_results` | array | 与该批次对应的二次生成结果行列表（展示/导出用的「有效」合并逻辑由服务层处理） |

**常见错误**：无效 `jobId`/`run_id`（400）、未认证（401）、无权限或不存在（404/403，见服务层 `ResumeProcessError` 映射）、服务器错误（500）。

---

### 5.4 `DELETE /resume-process/jobs/:jobId`

**成功响应**：HTTP **200**，JSON：`{ "message": "deleted" }`

**说明**：若任务对当前用户不存在，服务层按「未找到」处理为成功删除语义（不额外报错），与 `DeleteJob` 实现一致。

---

### 5.5 `GET /resume-process/subscribe/:jobId`

**Query**：`token`（JWT）**必填**。

**行为摘要**：

1. 校验 JWT 与任务归属（`user_id` 匹配）。
2. 若任务已失败 **或**（初次已完成 **且** 二次状态不在 `pending` / `processing` / `retrying`），则 **不建立 SSE**，直接返回 HTTP **200** 的 **JSON 快照**（非 `text/event-stream`）：

| 字段 | 含义 |
|------|------|
| `job_id` | 任务 ID |
| `stage` | `initial` 或 `secondary`（由当前订阅阶段推导） |
| `status` | 当前阶段对应状态字符串 |
| `job_status` | 初次流水线状态枚举值 |
| `secondary_status` | 二次流水线状态枚举值 |
| `message` | 如 `Job has already finished.` |

3. 否则设置响应头 `Content-Type: text/event-stream`，先发送 `retry: 2000`，再循环：
   - 订阅 Redis 频道：`resume-process:job:<jobId>`
   - 事件类型 **`message`**：payload 为 **JSON 字符串**（即 `ResumeProcessUpdatePayload` 序列化结果），见 [第 6 节](#6-sse-message-事件-payload-结构)
   - 事件类型 **`ping`**：约每 20 秒 `keepalive`
   - 当解析到 `message` 内 JSON 的 `status` 为终态（初次 `completed`/`failed` 或二次 `completed`/`completed_partial`/`failed`）时 **结束流**

---

### 5.6 `POST /resume-process/jobs/:jobId/trigger-secondary`

**请求体**：无 JSON 体要求（空 body 即可）。

**前置条件**（不满足则返回 409 等，具体见错误码）：

- 初次任务状态为 **已完成**，且存在已完成的 `ResumeInitialResult`
- 不存在进行中的二次批次（`pending`/`processing`/`retrying`）

**成功响应**：HTTP **202 Accepted**，JSON：

| 字段 | 类型 | 含义 |
|------|------|------|
| `message` | string | 如 `secondary generation accepted` |
| `job_id` | uint | 任务 ID |
| `run_id` | uint | 新建的二次批次 ID |

随后后台入队 `ResumeSecondary` 异步任务。

---

### 5.7 `GET /resume-process/jobs/:jobId/secondary-results`

**Query**：`run_id` 可选；省略时与详情接口相同，取**最新**二次批次。

**成功响应**：HTTP **200**，JSON：

| 字段 | 类型 | 含义 |
|------|------|------|
| `run` | object 或省略 | 批次元数据 |
| `items` | array | 该批次下各提示词的生成结果 |

---

### 5.8 `GET /resume-process/jobs/:jobId/export-template`

**Query**：`run_id` 可选；用于导出指定批次。若当前没有可导出的二次批次，服务返回冲突类错误（如 `secondary_run_not_found`）。

**成功响应**：HTTP **200**，**二进制流**

- `Content-Type: application/vnd.ms-excel`
- `Content-Disposition: attachment; filename="<导出名>.xls"`（默认名可能为 `resume_process_<jobId>.xls`）

**错误时**：仍可能返回 JSON 错误体（非文件流）。

---

## 6. SSE `message` 事件 Payload 结构

Redis 发布与服务端推送体为同一 JSON 对象（`ResumeProcessUpdatePayload`）：

| 字段 | 类型 | 含义 |
|------|------|------|
| `job_id` | uint | 任务 ID |
| `run_id` | uint 或省略 | 二次阶段时附带批次 ID |
| `stage` | string | `upload` / `initial` / `secondary` / `export` / `job`（SSE 中常见为 `initial` 或 `secondary`） |
| `status` | string | 阶段内状态：如 `processing`、`completed`、`failed`、`retrying`，或二次枚举字符串 |
| `message` | string | 人类可读说明（英文明文为主，如 `initial processing started`） |
| `retryable` | bool | 是否可重试（Asynq 重试场景） |
| `retry_after` | int 或省略 | 建议等待秒数 |
| `failed_prompt_ids` | uint[] 或省略 | 二次生成失败的提示词 ID 列表 |
| `job_status` | string 或省略 | 冗余：初次任务状态 |
| `secondary_status` | string 或省略 | 冗余：二次任务状态 |

**终态判断（客户端）**：与处理器逻辑一致，当 `status` 为 `completed`、`failed`、`completed_partial` 等终态字符串时，流结束。

---

## 7. 核心数据模型与字段含义

### 7.1 `ResumeProcessJob`

| JSON 字段 | 类型 | 含义 |
|------------|------|------|
| `id` | uint | 任务主键 |
| `user_id` | uint | 所属用户 |
| `source_file_id` | uint | 兼容字段：多文件时取 **第一个** 文件 ID |
| `source_file_ids` | JSON 数组 | 本次任务关联的全部源文件 ID |
| `status` | string | 初次流水线：`pending` / `processing` / `completed` / `failed` |
| `error_message` | string 或 null | 初次失败原因 |
| `secondary_status` | string | 二次流水线：`idle` / `pending` / `processing` / `retrying` / `completed` / `completed_partial` / `failed` |
| `secondary_error_message` | string 或 null | 二次失败/部分失败摘要 |
| `created_at` / `updated_at` | RFC3339 时间 | GORM 时间戳 |
| `deleted_at` | 时间或 null | 软删除标记 |

### 7.2 `ResumeInitialResult`

| JSON 字段 | 类型 | 含义 |
|------------|------|------|
| `id` | uint | 主键 |
| `job_id` | uint | 关联任务 |
| `raw_response` | string | LLM 原始文本 |
| `parsed_result` | JSON 或省略 | 若返回可解析 JSON 则为对象；否则可能为 `{"text":"..."}`；批量二次专用模式可能含元数据 |
| `status` | string | `processing` / `completed` / `error` |
| `error_message` | string 或 null | 错误说明 |
| `created_at` / `updated_at` | 时间 | — |

### 7.3 `ResumeSecondaryRun`

| JSON 字段 | 类型 | 含义 |
|------------|------|------|
| `id` | uint | 批次 ID（即接口中的 `run_id`） |
| `job_id` | uint | 关联任务 |
| `retry_of_run_id` | uint 或 null | 若为重试批次，指向父批次 |
| `status` | string | 与 `secondary_status` 枚举一致 |
| `prompt_ids` | JSON 数组 | 本批次要执行的提示词 ID 列表 |
| `failed_prompt_ids` | JSON 数组 | 失败的提示词 ID |
| `error_message` | string 或 null | 汇总错误 |
| `retryable` | bool | 是否处于可重试失败 |
| `retry_after_seconds` | int 或 null | 建议延迟 |
| `total_prompts` / `completed_prompts` / `error_prompts` | int | 统计 |
| `created_at` / `updated_at` | 时间 | — |

### 7.4 `ResumeSecondaryResult`

| JSON 字段 | 类型 | 含义 |
|------------|------|------|
| `id` | uint | 主键 |
| `job_id` | uint | 关联任务 |
| `secondary_run_id` | uint | 所属批次 |
| `prompt_id` | uint | 提示词模板 ID |
| `generated_text` | string | 该提示词生成正文 |
| `status` | string | `processing` / `completed` / `error` |
| `error_message` | string 或 null | 单行错误 |
| `created_at` / `updated_at` | 时间 | — |

---

## 8. 错误响应结构（resume-process 专用）

HTTP 4xx/5xx 时，响应体一般为 JSON：

| 字段 | 类型 | 含义 |
|------|------|------|
| `code` | string | 机器可读错误码，如 `job_not_found`、`secondary_run_in_progress` |
| `stage` | string | 错误所属阶段：`upload` / `initial` / `secondary` / `export` / `job` |
| `message` | string | 中文或双语说明，供前端展示 |
| `retryable` | bool | 是否建议用户稍后重试 |
| `retry_after` | int 或省略 | 建议等待秒数 |
| `failed_prompt_ids` | uint[] 或省略 | 与二次生成相关的失败提示词 |

HTTP 状态码由 `ResumeProcessError` 的 `HTTPStatus` 决定（例如 404 任务不存在、403 无权、409 状态冲突等）。

---

## 9. 与其它模块的关系（简）

- **文件记录**：上传写入 `files` 表，`task_type` 为 `resume_process`（见 `models.FileTaskTypeResumeProcess`），可通过 `GET /api/v1/files/query` 等文件接口按任务类型筛选（需 Bearer）。
- **异步执行**：`internal/core/workers` 中 `ResumeInitial` / `ResumeSecondary` 任务类型由 Asynq worker 消费；进度通过 Redis Pub/Sub 推送到 SSE。

---

## 10. 文档维护说明

- 路由与契约的单一事实来源仍以代码与 `docs/openapi` 生成物为准；若接口变更，请同步更新本说明或重新从 OpenAPI 对照校验。
- 端口与密钥以运行环境配置为准，勿将真实 `.env` 或密钥写入文档或仓库。
