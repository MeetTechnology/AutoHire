# GO_EIIE 材料审查适配层实现说明

**目标读者**：GO_EIIE 后端开发 AI / 开发者。

**目标**：在 GO_EIIE 中新增 AutoHire 材料审查外部后端适配层，使 AutoHire 在 `MATERIAL_REVIEW_MODE=live` 时，可以通过三条 `/reviews/*` 接口完成首轮六类材料审查、单类补件复审、轮询结果同步。

本文假设 AutoHire 已经实现“材料审查只读上下文 API”，GO_EIIE 可在 worker 内部通过 `applicationId` 拉取简历、材料文件元数据和临时下载地址。

---

## 1. 集成边界

### AutoHire 调 GO_EIIE

AutoHire 只调用 GO_EIIE 三个接口：

```text
POST /reviews/initial
POST /reviews/categories/{category}
GET  /reviews/{externalRunId}
```

AutoHire 创建任务请求体不会携带文件 `objectKey`、OSS URL、简历全文、上传批次 ID 或 AutoHire 内部 `reviewRunId`。GO_EIIE 必须使用 `applicationId` 再调用 AutoHire 只读上下文 API 获取审查所需数据。

### GO_EIIE 调 AutoHire

GO_EIIE 在异步任务执行时调用：

```text
GET {AUTOHIRE_BASE_URL}/api/internal/material-review/applications/{applicationId}/context
```

该 API 由 AutoHire 提供，只读、内部鉴权、返回审查上下文与文件下载信息。

---

## 2. AutoHire 只读上下文 API

### 2.1 请求

```http
GET /api/internal/material-review/applications/{applicationId}/context
Authorization: Bearer <MATERIAL_REVIEW_API_KEY>
Accept: application/json
```

可选查询参数：

| 参数                    | 说明                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| `category`              | 限定返回某一类材料。取值：`IDENTITY`、`EDUCATION`、`EMPLOYMENT`、`PROJECT`、`PATENT`、`HONOR` |
| `includeResume`         | 是否返回简历/申请摘要。默认 `true`                                                            |
| `downloadUrlTtlSeconds` | 临时下载 URL 过期秒数。默认 900；允许 60..3600                                                |

示例：

```text
GET /api/internal/material-review/applications/app_123/context?category=IDENTITY
```

### 2.2 响应

```json
{
  "applicationId": "app_123",
  "expert": {
    "name": "string or null",
    "email": "string or null",
    "phone": "string or null"
  },
  "resume": {
    "file": {
      "id": "resume_file_id",
      "fileName": "resume.pdf",
      "objectKey": "applications/app_123/resume/resume.pdf",
      "contentType": "application/pdf",
      "sizeBytes": 123456,
      "uploadedAt": "2026-05-11T10:00:00.000Z",
      "downloadUrl": "https://oss-signature-url"
    },
    "extractedData": {},
    "analysisResult": {}
  },
  "materials": {
    "IDENTITY": [
      {
        "id": "file_id",
        "source": "INITIAL_SUBMISSION",
        "category": "IDENTITY",
        "fileName": "passport.pdf",
        "objectKey": "applications/app_123/materials/IDENTITY/passport.pdf",
        "contentType": "application/pdf",
        "sizeBytes": 123456,
        "uploadedAt": "2026-05-11T10:00:00.000Z",
        "downloadUrl": "https://oss-signature-url"
      }
    ],
    "EDUCATION": [],
    "EMPLOYMENT": [],
    "PROJECT": [],
    "PATENT": [],
    "HONOR": []
  },
  "generatedAt": "2026-05-11T10:00:00.000Z"
}
```

### 2.3 字段要求

| 字段                        | 必填 | 说明                                                                    |
| --------------------------- | ---- | ----------------------------------------------------------------------- |
| `applicationId`             | 是   | AutoHire 申请 ID                                                        |
| `resume`                    | 建议 | 简历文件和已提取/分析结果；如果没有结构化结果，至少返回简历文件下载信息 |
| `materials`                 | 是   | 按六类分组的材料文件                                                    |
| `materials.*[].category`    | 是   | AutoHire 类别枚举                                                       |
| `materials.*[].fileName`    | 是   | 原始文件名                                                              |
| `materials.*[].contentType` | 是   | MIME type，可为 `null`                                                  |
| `materials.*[].objectKey`   | 可选 | OSS object key；如果 GO_EIIE 使用签名 URL 下载，可不依赖该字段          |
| `materials.*[].downloadUrl` | 是   | 短期可读签名 URL，GO_EIIE 用于下载文件                                  |
| `materials.*[].source`      | 是   | `INITIAL_SUBMISSION` 或 `SUPPLEMENT_UPLOAD`                             |

### 2.4 错误响应

建议 AutoHire 内部 API 使用：

```json
{
  "message": "Human readable message",
  "retryable": true
}
```

GO_EIIE 应按以下策略处理：

| HTTP 状态     | GO_EIIE 行为                                      |
| ------------- | ------------------------------------------------- |
| `401` / `403` | 标记 run `FAILED`，不可重试                       |
| `404`         | 标记 run `FAILED`，说明 applicationId 无法解析    |
| `429` / `5xx` | 可重试；短期 worker 重试，最终失败时返回 `FAILED` |
| 其它 `4xx`    | 标记 run `FAILED`，通常不可重试                   |

---

## 3. GO_EIIE 需要新增的外部接口

这些接口是给 AutoHire 调用的，不使用 GO_EIIE 现有用户 JWT。

### 3.1 鉴权

所有 `/reviews/*` 接口必须校验：

```http
Authorization: Bearer <MATERIAL_REVIEW_API_KEY>
```

建议新增配置：

```yaml
material_review:
  api_key: ""
  autohire_base_url: ""
  oss_download_dir: "tmp/material_review_downloads"
```

对应环境变量建议：

```text
MATERIAL_REVIEW_API_KEY
MATERIAL_REVIEW_AUTOHIRE_BASE_URL
MATERIAL_REVIEW_OSS_DOWNLOAD_DIR
```

说明：AutoHire 只读上下文 API 复用 `MATERIAL_REVIEW_API_KEY`，不再需要独立的 `MATERIAL_REVIEW_AUTOHIRE_INTERNAL_API_KEY`。

如果 `material_review.api_key` 为空，接口返回：

```json
{
  "message": "material review API is not configured",
  "retryable": false
}
```

HTTP 状态：`503`。

### 3.2 `POST /reviews/initial`

用途：首轮六类审查。

请求：

```json
{
  "applicationId": "app_123"
}
```

处理：

1. 校验 Bearer token。
2. 校验 `applicationId` 非空。
3. 创建 GO_EIIE 本地材料审查 run。
4. 入队异步任务。
5. 快速返回，不在 HTTP 请求内调用大模型。

响应：

```json
{
  "externalRunId": "mr-1",
  "status": "QUEUED",
  "startedAt": "2026-05-11T10:00:00Z",
  "finishedAt": null
}
```

### 3.3 `POST /reviews/categories/{category}`

用途：专家补件后，单类复审。

路径 `category`：

```text
IDENTITY | EDUCATION | EMPLOYMENT | PROJECT | PATENT | HONOR
```

请求：

```json
{
  "applicationId": "app_123",
  "category": "IDENTITY"
}
```

处理：

1. 校验 Bearer token。
2. 校验路径 `category` 与 body `category` 一致。
3. 创建 GO_EIIE 本地材料审查 run，记录触发类别。
4. 入队异步任务，只处理该类别。
5. 快速返回。

响应同 `POST /reviews/initial`。

### 3.4 `GET /reviews/{externalRunId}`

用途：AutoHire 轮询外部任务状态和结构化结果。

响应未完成示例：

```json
{
  "externalRunId": "mr-1",
  "status": "PROCESSING",
  "startedAt": "2026-05-11T10:00:00Z",
  "finishedAt": null,
  "categories": []
}
```

响应完成示例：

```json
{
  "externalRunId": "mr-1",
  "status": "COMPLETED",
  "startedAt": "2026-05-11T10:00:00Z",
  "finishedAt": "2026-05-11T10:02:00Z",
  "categories": [
    {
      "category": "IDENTITY",
      "status": "COMPLETED",
      "aiMessage": "缺身份证明，该专家为英国国籍，未提供有效护照。",
      "resultPayload": {
        "supplementRequired": true,
        "requests": [
          {
            "title": "Identity Documents supplement required",
            "reason": "缺身份证明，该专家为英国国籍，未提供有效护照。",
            "suggestedMaterials": [],
            "aiMessage": "缺身份证明，该专家为英国国籍，未提供有效护照。",
            "status": "PENDING"
          }
        ]
      },
      "rawResultPayload": {
        "source": "GO_EIIE customer_analysis",
        "categoryKey": "identity_documents"
      }
    }
  ]
}
```

重要约束：

- 顶层 `status !== "COMPLETED"` 时，`categories` 返回 `[]`。
- 顶层 `status === "COMPLETED"` 时，`categories` 中每项必须有 `resultPayload.supplementRequired` 和 `resultPayload.requests`。
- 若 `supplementRequired === true`，`requests` 不得为空。
- 每个 `requests[]` 必须有非空 `title`。

---

## 4. GO_EIIE 数据设计建议

### 4.1 最小新增表

建议新增一张适配层 run 表，避免复用 `customer_analysis_runs.id` 时缺少 `applicationId`、触发类别、错误状态等信息。

表名建议：`material_review_runs`

字段：

| 字段                        | 类型                 | 说明                                             |
| --------------------------- | -------------------- | ------------------------------------------------ |
| `id`                        | bigint primary key   | 内部 ID                                          |
| `external_run_id`           | text unique not null | 返回给 AutoHire，例如 `mr-1` 或 UUID             |
| `application_id`            | text not null        | AutoHire applicationId                           |
| `trigger_type`              | varchar              | `INITIAL` 或 `CATEGORY`                          |
| `triggered_category`        | varchar nullable     | 单类复审类别，AutoHire 枚举                      |
| `status`                    | varchar not null     | `queued` / `processing` / `completed` / `failed` |
| `customer_analysis_run_id`  | bigint nullable      | 若复用 customer analysis run，记录关联           |
| `error_message`             | text nullable        | 失败原因                                         |
| `started_at`                | timestamptz nullable | 开始时间                                         |
| `finished_at`               | timestamptz nullable | 结束时间                                         |
| `created_at` / `updated_at` | timestamptz          | 审计字段                                         |

### 4.2 applicationId 映射

GO_EIIE 必须知道 AutoHire `applicationId` 对应哪个 GO_EIIE `user_id/customer_id`。

表名建议：`material_review_application_mappings`

字段：

| 字段                        | 类型                 | 说明                   |
| --------------------------- | -------------------- | ---------------------- |
| `application_id`            | text unique not null | AutoHire applicationId |
| `user_id`                   | bigint not null      | GO_EIIE user id        |
| `customer_id`               | bigint not null      | GO_EIIE customer id    |
| `created_at` / `updated_at` | timestamptz          | 审计字段               |

初期可以通过脚本、后台管理、或同步任务写入该表。`/reviews/*` 不建议从 `applicationId` 字符串里硬解析 customer id。

---

## 5. 类别映射

GO_EIIE 与 AutoHire 类别必须固定映射：

| AutoHire     | GO_EIIE category_key             | GO_EIIE 配置文件                     |
| ------------ | -------------------------------- | ------------------------------------ |
| `IDENTITY`   | `identity_documents`             | `identity_documents_default.yaml`    |
| `EDUCATION`  | `educational_credentials`        | `academic_credentials_default.yaml`  |
| `EMPLOYMENT` | `employment_verification`        | `work_certificate_default.yaml`      |
| `PROJECT`    | `research_project_documentation` | `project_documentation_default.yaml` |
| `PATENT`     | `patent_documentation`           | `patent_documentation_default.yaml`  |
| `HONOR`      | `honors_documentation`           | `honors_documentation_default.yaml`  |

首轮审查应处理六类。单类复审只处理路径指定类别。

---

## 6. 状态映射

GO_EIIE 内部状态建议保持 lowercase；对 AutoHire 输出时转换：

| GO_EIIE              | AutoHire     |
| -------------------- | ------------ |
| `queued` / `pending` | `QUEUED`     |
| `processing`         | `PROCESSING` |
| `completed`          | `COMPLETED`  |
| `failed`             | `FAILED`     |

`customer_analysis` 结果项状态转换：

| GO_EIIE item | AutoHire category                                 |
| ------------ | ------------------------------------------------- |
| `pending`    | `QUEUED`                                          |
| `processing` | `PROCESSING`                                      |
| `completed`  | `COMPLETED`                                       |
| `failed`     | `FAILED`                                          |
| `skipped`    | `COMPLETED`，但需产生 `supplementRequired: false` |

---

## 7. OSS 文件获取方案

### 7.1 推荐方式：使用 AutoHire 签名 URL 下载

GO_EIIE 不直接依赖 AutoHire OSS bucket 权限，而是使用 context API 返回的 `downloadUrl`。

流程：

1. worker 调 AutoHire context API。
2. 读取 `resume.downloadUrl` 和 `materials[category][].downloadUrl`。
3. 下载文件到本地临时目录，例如：

```text
tmp/material_review_downloads/{externalRunId}/{category}/{fileId}-{safeFileName}
```

4. 生成 GO_EIIE `models.File` 或等价的临时文件输入，复用现有 Gemini inline file 处理逻辑。
5. 任务结束后可异步清理临时文件。

### 7.2 备选方式：GO_EIIE 直连 OSS

若 AutoHire 只返回 `objectKey` 而不返回 `downloadUrl`，GO_EIIE 需要新增阿里云 OSS 客户端配置：

```yaml
material_review:
  oss:
    endpoint: ""
    bucket: ""
    access_key_id: ""
    access_key_secret: ""
```

环境变量建议：

```text
MATERIAL_REVIEW_OSS_ENDPOINT
MATERIAL_REVIEW_OSS_BUCKET
MATERIAL_REVIEW_OSS_ACCESS_KEY_ID
MATERIAL_REVIEW_OSS_ACCESS_KEY_SECRET
```

实现建议：

- 新增 `pkg/oss` 或 `pkg/alioss` 客户端。
- 只授予只读权限。
- 下载时校验 `objectKey` 非空且不包含路径穿越。
- 下载文件大小不得超过 GO_EIIE 当前文件处理上限。

首选仍是签名 URL，因为权限边界更清晰。

---

## 8. 与现有 customer_analysis 的复用方式

当前 GO_EIIE 已有：

- `CustomerAnalysisService.CreateRun`
- `CustomerAnalysisService.ProcessRun`
- `CustomerAnalysisRule`
- `CustomerCategoryAnalysisResult`
- 六类 YAML 规则和 prompt

最小改动方向：

1. 新增 `MaterialReviewService`，作为适配层。
2. `MaterialReviewService` 负责：
   - 创建 `material_review_runs`
   - 调 AutoHire context API
   - 下载 OSS 文件
   - 将 context 文件转换成 GO_EIIE 可处理的临时文件记录
   - 按类别调用已有 customer analysis 规则处理逻辑
   - 转换结果给 `/reviews/{externalRunId}`
3. 尽量不要改变现有 `/api/v1/customer-analyses/*` 的行为。

### 8.1 单类处理能力

当前 `CustomerAnalysisService.ProcessRun` 会处理全部 active category rules。为了支持 AutoHire 单类复审，建议提取一个内部方法：

```go
ProcessRunWithCategoryFilter(ctx, runID, allowedCategoryKeys)
```

行为：

- `allowedCategoryKeys == nil` 或空：保持原有全量处理。
- 非空：只加载并执行指定 category key 的规则。

也可以更小范围地新增 `ProcessMaterialReviewRun`，内部复用 `processResumeProfile`、`processCategoryRule`，但注意这些方法目前是非导出方法，最好保持在同 package 内实现。

---

## 9. 模型输出到 AutoHire 结果的转换

### 9.1 从 GO_EIIE 结果中提取结构化 JSON

GO_EIIE prompt 已要求返回 JSON，包含 `audit_status` 和 `communication_text`。当前代码仍主要保存 `AnswerText`，`StructuredData` / `CommunicationText` 可能为空。

建议新增解析逻辑：

1. 从 `AnswerText` 或 `RawResponse` 中提取 JSON。
2. 保存到 `CustomerCategoryAnalysisResult.StructuredData`。
3. 将 `communication_text` 保存到 `CommunicationText`。
4. 如果解析失败，保留原文，并在结果转换时用原文作为 `aiMessage/reason`。

### 9.2 完整/不完整判定

推荐判定顺序：

1. 若结构化 JSON 中 `audit_status == "complete"`：无需补件。
2. 若 `communication_text` 包含完整标记之一：无需补件。
   - `<身份证明完整>`
   - `<学历证明完整>`
   - `<工作证明完整>`
   - `<项目证明完整>`
   - `<专利证明完整>`
   - `<荣誉证明完整>`
3. 否则，只要 `communication_text` 或 `AnswerText` 非空：需要补件。
4. 若类别没有任何文件且模型输出为空：需要补件，给出兜底 reason。

### 9.3 AutoHire `resultPayload` 生成

无需补件：

```json
{
  "supplementRequired": false,
  "requests": []
}
```

需要补件：

```json
{
  "supplementRequired": true,
  "requests": [
    {
      "title": "{Category Label} supplement required",
      "reason": "{communication_text}",
      "suggestedMaterials": [],
      "aiMessage": "{communication_text}",
      "status": "PENDING"
    }
  ]
}
```

类别标题建议：

| Category     | Title                                      |
| ------------ | ------------------------------------------ |
| `IDENTITY`   | `Identity Documents supplement required`   |
| `EDUCATION`  | `Education Documents supplement required`  |
| `EMPLOYMENT` | `Employment Documents supplement required` |
| `PROJECT`    | `Project Documents supplement required`    |
| `PATENT`     | `Patent Documents supplement required`     |
| `HONOR`      | `Honor Documents supplement required`      |

若 `communication_text` 有多行，可以选择：

- 最小实现：全部放入一个 request 的 `reason`。
- 后续优化：按行拆成多个 requests，每行一个 request。

---

## 10. 建议新增代码结构

建议文件：

```text
internal/handlers/material_review_handler.go
internal/core/services/material_review_service.go
internal/core/services/material_review_autohire_client.go
internal/core/services/material_review_adapter.go
internal/core/models/material_review.go
internal/core/workers/material_review_worker.go
internal/core/workers/tasks.go
internal/middleware/static_bearer.go 或 material_review_api_key.go
pkg/alioss/client.go
internal/database/migrations/xxxxx_create_material_review_tables.up.sql
internal/database/migrations/xxxxx_create_material_review_tables.down.sql
```

路由注册：

```go
r.POST("/reviews/initial", materialReviewMW, materialReviewHandler.CreateInitial)
r.POST("/reviews/categories/:category", materialReviewMW, materialReviewHandler.CreateCategory)
r.GET("/reviews/:externalRunId", materialReviewMW, materialReviewHandler.GetResult)
```

如果希望统一在 `/api/v1` 下，也可以额外注册：

```text
/api/v1/reviews/initial
/api/v1/reviews/categories/:category
/api/v1/reviews/:externalRunId
```

但 AutoHire 的 `MATERIAL_REVIEW_BASE_URL` 应配置到正确 base，例如：

```text
MATERIAL_REVIEW_BASE_URL=http://go-eiie:8079
```

或：

```text
MATERIAL_REVIEW_BASE_URL=http://go-eiie:8079/api/v1
```

---

## 11. 异步 worker 流程

### 首轮

```text
POST /reviews/initial
  -> create material_review_run(trigger_type=INITIAL, status=queued)
  -> enqueue material_review_task(externalRunId)
  -> return externalRunId

worker
  -> mark run processing
  -> GET AutoHire context API
  -> download resume + six category files
  -> build temporary GO_EIIE file inputs
  -> run resume profile extraction/conversation
  -> run six category rules
  -> save category results
  -> mark completed
```

### 单类复审

```text
POST /reviews/categories/IDENTITY
  -> create material_review_run(trigger_type=CATEGORY, triggered_category=IDENTITY)
  -> enqueue material_review_task(externalRunId)
  -> return externalRunId

worker
  -> mark run processing
  -> GET AutoHire context API with ?category=IDENTITY
  -> download resume + IDENTITY files
  -> run resume profile if needed
  -> run only identity_documents rule
  -> save category result
  -> mark completed
```

---

## 12. 失败处理

创建任务阶段：

- 参数非法：`400`
- token 错误：`401`
- 未配置：`503`
- 入队失败：`503`，`retryable: true`

查询阶段：

- `externalRunId` 不存在：`404`
- run failed：HTTP 200，业务状态返回 `FAILED`

失败状态响应示例：

```json
{
  "externalRunId": "mr-1",
  "status": "FAILED",
  "startedAt": "2026-05-11T10:00:00Z",
  "finishedAt": "2026-05-11T10:01:00Z",
  "categories": []
}
```

注意：`GET /reviews/{externalRunId}` 不建议在 run 失败时返回 HTTP 500；应返回 HTTP 200 + `status: "FAILED"`，让 AutoHire 正常同步状态。

---

## 13. AutoHire 配置对齐

AutoHire `.env`：

```text
MATERIAL_REVIEW_MODE=live
MATERIAL_REVIEW_BASE_URL=http://go-eiie:8079
MATERIAL_REVIEW_API_KEY=<same as GO_EIIE material_review.api_key>
```

GO_EIIE 配置：

```text
MATERIAL_REVIEW_API_KEY=<same value>
MATERIAL_REVIEW_AUTOHIRE_BASE_URL=http://autohire:3000
```

如果 GO_EIIE 使用直连 OSS，再补充 OSS 配置；如果使用签名 URL，则不需要 OSS AK/SK。

---

## 14. 开发计划建议

### 阶段 1：接口壳与鉴权

- 新增 material review 静态 Bearer middleware。
- 注册 `/reviews/*` 三个路由。
- 新增请求/响应 DTO。
- 创建 run 后先返回 `QUEUED`，GET 可查到 `QUEUED`。

### 阶段 2：数据表和任务队列

- 新增 `material_review_runs`。
- 新增 `material_review_application_mappings`。
- 新增 asynq task payload。
- worker 可将 run 从 `queued` 改为 `processing` 再改为 `failed/completed`。

### 阶段 3：AutoHire context client

- 实现 `GET /api/internal/material-review/applications/{applicationId}/context` client。
- 支持 category 查询参数。
- 实现错误映射和重试策略。

### 阶段 4：文件下载

- 优先实现签名 URL 下载。
- 下载到 `tmp/material_review_downloads/{externalRunId}`。
- 校验文件名、大小、Content-Type。
- 如确需 OSS 直连，再新增阿里云 OSS client。

### 阶段 5：复用 customer analysis

- 添加 category filter 能力。
- 首轮跑六类。
- 单类复审只跑指定类别。
- 保持现有 `/api/v1/customer-analyses/*` 不变。

### 阶段 6：结果转换

- 解析 `AnswerText` 中 JSON。
- 提取 `communication_text` 和 `audit_status`。
- 转为 AutoHire `categories[].resultPayload`。
- GET completed 时返回合法结构。

### 阶段 7：联调

- AutoHire 配置 live mode。
- 用一个 applicationId 建立 GO_EIIE mapping。
- 验证：
  - `POST /reviews/initial` 15 秒内返回。
  - `GET /reviews/{externalRunId}` 进行中返回 `categories: []`。
  - 完成后返回六类结果。
  - 单类补件复审只返回该类别结果。

---

## 15. 联调检查清单

- [ ] GO_EIIE `/reviews/*` 接口接受 `Authorization: Bearer`。
- [ ] AutoHire `MATERIAL_REVIEW_BASE_URL` 不带多余路径错误。
- [ ] `applicationId` 可在 GO_EIIE 映射到 `user_id/customer_id`。
- [ ] GO_EIIE 能调用 AutoHire context API。
- [ ] GO_EIIE 能下载 context API 返回的文件。
- [ ] 首轮完成时返回六类 category。
- [ ] 单类复审完成时只返回触发类别。
- [ ] 每个 completed category 都有 `resultPayload.supplementRequired` 与 `requests`。
- [ ] `supplementRequired=true` 时 `requests` 至少一项，且 `title` 非空。
- [ ] 状态只返回 `QUEUED`、`PROCESSING`、`COMPLETED`、`FAILED`。
- [ ] 非 2xx 错误体尽量包含 `message` 和 `retryable`。

---

## 16. 非目标

本次最小适配不要求：

- GO_EIIE 调 AutoHire callback。
- AutoHire 在 `/reviews/initial` 请求中发送文件列表。
- GO_EIIE 执行原有文件分类流程。
- GO_EIIE 改造现有 customer analysis UI/API。
- 将 AutoHire 用户上传文件长期复制到 GO_EIIE 存储。

最小闭环是：AutoHire 调 `/reviews/*` 创建与查询任务；GO_EIIE 通过 AutoHire 只读上下文 API 拉取文件；GO_EIIE 复用现有沟通需求生成能力；GO_EIIE 返回 AutoHire 可消费的结构化补件结果。
