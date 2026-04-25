# 简历提取结果人工校对接口变更说明

## Summary

本次后端更新在简历初次分析拆分流程中新增“提取结果校对”能力：前端可在信息提取完成后、资格判断前提交人工校对后的 11 项提取文本，后续资格判断会使用校对后的内容。原一次性上传分析接口保持兼容。

## Scope

- 模块/功能：`resume-process` 简历初次分析拆分流程。
- 涉及调用方：前端页面、前端 API client、使用拆分流程的外部调用方。
- 主要场景：上传简历仅提取 → 展示/人工校对提取信息 → 触发资格判断。
- 不包含：旧 `POST /api/v1/resume-process/upload` 一次性初次分析接口改造。

## Endpoint Inventory

| Method | Path | Purpose | Auth | Status | Frontend Priority |
| --- | --- | --- | --- | --- | --- |
| `POST` | `/api/v1/resume-process/extraction/upload` | 上传简历并仅执行 11 项信息提取 | Bearer JWT | existing | high |
| `PATCH` | `/api/v1/resume-process/jobs/{jobId}/extraction` | 校对并覆盖已完成的信息提取结果 | Bearer JWT | added | high |
| `POST` | `/api/v1/resume-process/jobs/{jobId}/judge-eligibility` | 基于最新提取结果触发资格判断 | Bearer JWT | existing, behavior clarified | high |
| `GET` | `/api/v1/resume-process/jobs/{jobId}` | 查询 job 与 `initial_result` 分阶段结果 | Bearer JWT | existing | high |
| `GET` | `/api/v1/resume-process/subscribe/{jobId}?token=<JWT>` | 订阅 job 进度 | Query token | existing | medium |

## Confirmed Backend Changes

### 已确认

- 新增 `PATCH /api/v1/resume-process/jobs/{jobId}/extraction`。
- 新接口接收校对后的完整提取文本字段：`extraction_raw_response`。
- 新接口只允许在提取完成后调用。
- 新接口会拒绝资格判断正在进行中或已完成的 job。
- 校对成功后，后端更新 `extraction_raw_response`，并同步更新兼容字段 `raw_response`。
- 后续 `judge-eligibility` 继续读取最新的 `extraction_raw_response`，因此会使用人工校对后的提取结果。
- 校对接口是同步接口，不会自动触发资格判断，不会重新上传或重新读取简历文件。

### 前端通常无需处理

- 原 `POST /api/v1/resume-process/upload` 一次性初次分析接口未改变。
- 原 SSE 订阅机制未新增独立频道。
- 原 job detail 查询体系未拆分出新查询接口。

## API Contract Changes

| Type | Name | Before | After | Frontend Impact |
| --- | --- | --- | --- | --- |
| Route | `PATCH /api/v1/resume-process/jobs/{jobId}/extraction` | 无 | 新增同步校对接口 | 前端需新增 API client 方法 |
| Request | `extraction_raw_response` | 无 | 必填 string | 前端需提交完整 `### 1. Extracted Information` 文本块 |
| Response | correction response | 无 | 返回 `message`、`job_id`、`extraction_raw_response`、`extraction_status`、`raw_response`、`status` | 前端可用响应更新本地详情状态 |
| Error | extraction correction errors | 无 | 新增/复用 `400`、`401`、`403`、`404`、`409`、`500` 错误响应 | 前端需增加错误码映射和按钮禁用逻辑 |
| Flow | qualification judgment input | 直接使用提取阶段结果 | 使用最新 `extraction_raw_response`，可能是人工校对后的文本 | 前端应在校对成功后再触发资格判断 |

## Endpoint Details

### Endpoint: `POST /api/v1/resume-process/extraction/upload`

#### 已确认

- 用途：上传简历，只执行 11 项信息提取，不触发资格判断。
- 前端触发时机：用户选择简历文件并开始拆分流程时。
- 鉴权/权限：Bearer JWT。
- Headers：`Authorization: Bearer <token>`；`Content-Type: multipart/form-data`。
- 表单字段：
  - `files`：可选，多文件字段，可重复。
  - `file`：可选，单文件兼容字段。
- 文件限制：`.pdf` / `.docx` / `.doc`。
- 成功响应：`202 Accepted`。
- 异步行为：后端入队 `resume:extract`，前端需要通过 SSE 或 job detail 查询等待提取完成。

#### Response Example

```json
{
  "message": "resume extraction job accepted",
  "job_id": 123,
  "files_count": 1
}
```

#### 前端接入提示

- `前端需处理`：上传成功后保存 `job_id`，进入提取中状态。
- `前端需处理`：轮询 `GET /jobs/{jobId}` 或订阅 SSE，直到 `initial_result.extraction_status === "completed"`。
- `前端需处理`：提取完成后展示 `initial_result.extraction_raw_response` 供人工校对。

### Endpoint: `PATCH /api/v1/resume-process/jobs/{jobId}/extraction`

#### 已确认

- 用途：提交人工校对后的提取结果。
- 前端触发时机：提取完成后，用户编辑并确认 11 项提取信息时。
- 鉴权/权限：Bearer JWT；job 必须属于当前用户。
- Headers：`Authorization: Bearer <token>`；`Content-Type: application/json`。
- Path 参数：
  - `jobId`：无符号整数。
- Query 参数：无。
- Request Body：
  - `extraction_raw_response`：必填 string，校对后的完整提取文本。
- Success Response：`200 OK`。
- 副作用：
  - 更新 `initial_result.extraction_raw_response`。
  - 更新 `initial_result.extraction_parsed_result`。
  - 同步更新兼容字段 `raw_response` / `parsed_result` / `status`。
  - 不覆盖已完成的 `judgment_*` 结果。
- 异步行为：无。该接口不入队任务。
- 幂等性/重试建议：
  - 使用同一文本重复提交通常会得到相同状态。
  - 如果请求超时，前端可重新查询 job detail 确认是否已写入。
- 兼容性说明：
  - 不影响旧一次性上传接口。
  - 校对成功后，后续资格判断会使用最新 `extraction_raw_response`。

#### Request Example

```json
{
  "extraction_raw_response": "### 1. Extracted Information\n- Name: Corrected Name\n- Personal Email: !!!null!!!\n- Work Email: corrected@example.edu\n- Phone Number: !!!null!!!\n- Year of Birth: 1988\n- Doctoral Degree Status: Obtained\n- Doctoral Graduation Time: 2018\n- Current Title Equivalence: Associate Professor\n- Current Country of Employment: United States\n- Work Experience (2020-Present): 2020-Present, United States, Example University, Associate Professor\n- Research Area: Advanced manufacturing materials"
}
```

#### Response Example

```json
{
  "message": "resume extraction corrected",
  "job_id": 123,
  "extraction_raw_response": "### 1. Extracted Information\n- Name: Corrected Name\n...",
  "extraction_status": "completed",
  "raw_response": "### 1. Extracted Information\n- Name: Corrected Name\n...",
  "status": "completed"
}
```

#### Error Responses

| HTTP | code | Meaning | Frontend handling |
| --- | --- | --- | --- |
| `400` | `invalid_job_id` | `jobId` 不是合法数字 | 前端通常应避免发出该请求；若出现则显示通用参数错误 |
| `400` | `invalid_extraction_correction_request` | JSON 请求体无效或缺少必填字段 | 提示用户重试或检查表单数据 |
| `400` | `invalid_extraction_correction` | `extraction_raw_response` 为空 | 禁用提交按钮或提示“校对内容不能为空” |
| `400` | `invalid_extraction_format` | 内容缺少 `### 1. Extracted Information` 段落 | 提示用户提交完整提取信息块 |
| `401` | `unauthorized` | 未登录或 token 无效 | 跳转登录或刷新 token |
| `403` | `job_forbidden` | 当前用户无权访问该 job | 提示无权限 |
| `404` | `job_not_found` | job 不存在或不可见 | 提示任务不存在或刷新列表 |
| `409` | `extraction_not_completed` | 信息提取尚未完成 | 保持提取中状态，继续轮询/SSE |
| `409` | `judgment_in_progress` | 资格判断正在进行 | 禁止编辑，展示判断中状态 |
| `409` | `judgment_completed` | 资格判断已完成 | 禁止编辑，提示如需修改需重新走流程 |
| `500` | `extraction_correction_failed` 或 `extraction_correction_save_failed` | 后端保存失败 | 展示失败提示，可允许用户重试 |

#### 字段语义

| Field | Location | Type | Required | Meaning | Allowed values | Default / Null | Frontend note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `jobId` | path | integer | yes | resume-process job ID | 正整数 | 无 | 从提取上传或 job 列表/详情获取 |
| `extraction_raw_response` | request | string | yes | 校对后的完整 11 项提取文本 | 需包含 `### 1. Extracted Information` | 不能为空 | 建议保留原 Markdown 字段格式 |
| `message` | response | string | yes | 操作结果消息 | `resume extraction corrected` | 无 | 可不直接展示给用户 |
| `job_id` | response | integer | yes | 被更新的 job ID | 正整数 | 无 | 用于校验本地 job |
| `extraction_raw_response` | response | string | yes | 保存后的提取文本 | 文本 | 无 | 可回填编辑区或本地缓存 |
| `extraction_status` | response | string | yes | 提取阶段状态 | `completed` | 无 | 校对成功后仍为完成 |
| `raw_response` | response | string | yes | 兼容字段，判断前等于最新提取文本 | 文本 | 无 | 老客户端若读取此字段会看到校对后内容 |
| `status` | response | string | yes | 兼容状态字段 | `completed` | 无 | 判断完成前仍表示提取结果可读 |

### Endpoint: `POST /api/v1/resume-process/jobs/{jobId}/judge-eligibility`

#### 已确认

- 用途：基于已完成的信息提取结果触发资格判断。
- 前端触发时机：
  - 未人工校对：提取完成后可直接触发。
  - 需要人工校对：校对接口成功后再触发。
- 鉴权/权限：Bearer JWT；job 必须属于当前用户。
- Request Body：无。
- 成功响应：`202 Accepted`。
- 异步行为：后端入队 `resume:judge_eligibility`。
- 输入来源：后端只读取最新 `extraction_raw_response`，不重新读取简历文件。

#### Response Example

```json
{
  "message": "eligibility judgment accepted",
  "job_id": 123
}
```

#### 前端接入提示

- `前端需处理`：触发前确认 `initial_result.extraction_status === "completed"`。
- `前端需处理`：如果用户修改过提取信息，必须等待校对接口 `200 OK` 后再触发判断。
- `前端需处理`：触发后进入判断中状态，使用 SSE 或 job detail 查询等待 `judgment_status` 更新。

## Frontend Actions Required

### 前端需处理

- [ ] 新增 API client 方法：`PATCH /api/v1/resume-process/jobs/{jobId}/extraction`。
- [ ] 在提取结果页支持展示和编辑 `initial_result.extraction_raw_response`。
- [ ] 校对提交前校验内容非空，且保留完整 `### 1. Extracted Information` 文本块。
- [ ] 校对成功后更新本地 job detail 缓存中的 `extraction_raw_response` 与 `raw_response`。
- [ ] 校对成功后再允许用户触发 `judge-eligibility`。
- [ ] 当 `judgment_status` 为 `processing` 或 `completed` 时禁用校对入口。
- [ ] 为 `409 extraction_not_completed`、`409 judgment_in_progress`、`409 judgment_completed` 增加明确提示。
- [ ] 联调 SSE 或轮询状态：提取中、可校对、判断中、判断完成。

### 推测

- 如果前端有“二次生成”入口，建议在资格判断完成后再开放，避免使用仅提取段的 `raw_response`。

## Breaking Changes And Compatibility

- 是否存在破坏性变更：无。
- 兼容策略：
  - 原 `POST /api/v1/resume-process/upload` 不变。
  - 原拆分流程中的上传、查询、SSE、资格判断接口继续可用。
  - 新接口是增量能力，不要求所有调用方立即接入。
- 前端最低改造要求：
  - 若不需要人工校对，可不接入新接口。
  - 若需要人工校对，必须新增校对提交动作，并调整判断按钮启用条件。

## Verification And Test Guidance

### 联调最小清单

- [ ] 上传简历到 `/extraction/upload`，拿到 `job_id`。
- [ ] 等待 `initial_result.extraction_status` 变为 `completed`。
- [ ] 展示 `initial_result.extraction_raw_response`。
- [ ] 修改其中一个字段，调用 `PATCH /jobs/{jobId}/extraction`。
- [ ] 确认响应中 `extraction_raw_response` 和 `raw_response` 都是校对后的文本。
- [ ] 调用 `/jobs/{jobId}/judge-eligibility`。
- [ ] 等待判断完成，确认最终 `raw_response` 变为完整三段式结果。
- [ ] 在判断 `processing` 或 `completed` 后再次调用校对接口，确认返回 `409`。

### 建议测试输入

```json
{
  "extraction_raw_response": "### 1. Extracted Information\n- Name: Corrected Name\n- Personal Email: !!!null!!!\n- Work Email: corrected@example.edu\n- Phone Number: !!!null!!!\n- Year of Birth: 1988\n- Doctoral Degree Status: Obtained\n- Doctoral Graduation Time: 2018\n- Current Title Equivalence: Associate Professor\n- Current Country of Employment: United States\n- Work Experience (2020-Present): 2020-Present, United States, Example University, Associate Professor\n- Research Area: Advanced manufacturing materials"
}
```

### 建议观察点

- Network 请求方法是否为 `PATCH`。
- 请求路径是否包含正确 `jobId`。
- Header 是否包含 Bearer token。
- Payload 是否只包含 `extraction_raw_response`。
- 校对成功后，前端缓存是否刷新。
- 判断触发前是否使用最新提取文本。
- 错误码是否映射为清晰 UI 提示。

## Risks And Items To Confirm

### 待确认

- 前端是否需要字段级编辑器，还是直接编辑完整 Markdown 文本块即可。
- 前端是否需要展示 `extraction_parsed_result`，当前校对响应不要求前端依赖该字段。
- 校对操作是否需要二次确认弹窗或审计展示，当前后端未提供单独审计记录。

### 联调建议

- 优先以 job detail 中的 `initial_result.extraction_raw_response` 作为编辑器初始值。
- 校对成功后建议重新拉取 job detail，避免本地状态与后端不一致。
- 判断开始后应锁定校对编辑区，避免用户误以为还能修改本次判断输入。
