# API Spec

## 模块 1：补件审查摘要

### API：获取补件审查摘要

- Method：`GET`
- Path：`/api/applications/{applicationId}/material-supplement/summary`
- Auth：
  - 专家端 HttpOnly session。
  - session 必须属于当前 `applicationId`。
  - `Application.applicationStatus` 必须为 `SUBMITTED`。
- Request：
  - Path Params：
    - `applicationId`：string，必填，申请 ID。
  - Query Params：无。
  - Body：无。
- Response：

```json
{
  "applicationId": "app_001",
  "materialSupplementStatus": "REVIEWING",
  "latestReviewRunId": "run_001",
  "latestReviewedAt": null,
  "pendingRequestCount": 2,
  "satisfiedRequestCount": 1,
  "remainingReviewRounds": 2,
  "supportedCategories": [
    "IDENTITY",
    "EDUCATION",
    "EMPLOYMENT",
    "PROJECT",
    "PATENT",
    "HONOR"
  ]
}
```

- Error Codes：
  - `UNAUTHORIZED`：session 不存在或已失效。
  - `FORBIDDEN`：当前 session 无权访问该申请。
  - `APPLICATION_NOT_FOUND`：申请不存在。
  - `APPLICATION_NOT_SUBMITTED`：申请尚未最终提交，不能进入补件流程。
  - `SUPPLEMENT_SUMMARY_LOAD_FAILED`：摘要读取失败。
- Example：

请求：

```http
GET /api/applications/app_001/material-supplement/summary
Cookie: autohire_session=...
```

响应：

```json
{
  "applicationId": "app_001",
  "materialSupplementStatus": "SUPPLEMENT_REQUIRED",
  "latestReviewRunId": "run_001",
  "latestReviewedAt": "2026-05-05T09:30:00.000Z",
  "pendingRequestCount": 3,
  "satisfiedRequestCount": 0,
  "remainingReviewRounds": 2,
  "supportedCategories": [
    "IDENTITY",
    "EDUCATION",
    "EMPLOYMENT",
    "PROJECT",
    "PATENT",
    "HONOR"
  ]
}
```

### API：确保首轮审查存在

- Method：`POST`
- Path：`/api/applications/{applicationId}/material-supplement/reviews/initial`
- Auth：
  - 专家端 HttpOnly session。
  - session 必须属于当前 `applicationId`。
  - `Application.applicationStatus` 必须为 `SUBMITTED`。
- Request：
  - Path Params：
    - `applicationId`：string，必填。
  - Body：空对象。
  - 幂等要求：
    - 如果首轮 `runNo=1` 已存在，直接返回已有 run。
    - 不重复创建首轮审查。
- Response：

```json
{
  "applicationId": "app_001",
  "reviewRunId": "run_001",
  "runNo": 1,
  "status": "QUEUED",
  "created": true
}
```

- Error Codes：
  - `UNAUTHORIZED`
  - `FORBIDDEN`
  - `APPLICATION_NOT_FOUND`
  - `APPLICATION_NOT_SUBMITTED`
  - `INITIAL_REVIEW_CREATE_FAILED`：首轮审查创建失败。
  - `MATERIAL_REVIEW_BACKEND_UNAVAILABLE`：外部 AI 审查后端不可用。
- Example：

请求：

```http
POST /api/applications/app_001/material-supplement/reviews/initial
Content-Type: application/json
Cookie: autohire_session=...

{}
```

响应：

```json
{
  "applicationId": "app_001",
  "reviewRunId": "run_001",
  "runNo": 1,
  "status": "QUEUED",
  "created": false
}
```

## 模块 2：补件页面快照

### API：获取补件页面快照

- Method：`GET`
- Path：`/api/applications/{applicationId}/material-supplement`
- Auth：
  - 专家端 HttpOnly session。
  - session 必须属于当前 `applicationId`。
  - `Application.applicationStatus` 必须为 `SUBMITTED`。
- Request：
  - Path Params：
    - `applicationId`：string，必填。
  - Query Params：无。
  - Body：无。
- Response：

```json
{
  "applicationId": "app_001",
  "summary": {
    "materialSupplementStatus": "SUPPLEMENT_REQUIRED",
    "latestReviewRunId": "run_001",
    "latestReviewedAt": "2026-05-05T09:30:00.000Z",
    "pendingRequestCount": 2,
    "satisfiedRequestCount": 1,
    "remainingReviewRounds": 2
  },
  "categories": [
    {
      "category": "EDUCATION",
      "label": "Education Documents",
      "status": "SUPPLEMENT_REQUIRED",
      "isReviewing": false,
      "latestCategoryReviewId": "cat_review_001",
      "latestReviewedAt": "2026-05-05T09:30:00.000Z",
      "aiMessage": "Please provide proof of the doctoral degree listed in your CV.",
      "pendingRequestCount": 1,
      "requests": [
        {
          "id": "req_001",
          "title": "Doctoral degree proof required",
          "reason": "The submitted documents do not clearly prove the doctoral degree listed in the CV.",
          "suggestedMaterials": [
            "Doctoral degree certificate",
            "Education verification report"
          ],
          "aiMessage": "Please upload a doctoral degree certificate or an equivalent education verification document.",
          "status": "PENDING",
          "isSatisfied": false,
          "updatedAt": "2026-05-05T09:30:00.000Z"
        }
      ],
      "draftFiles": [],
      "waitingReviewFiles": []
    }
  ]
}
```

- Error Codes：
  - `UNAUTHORIZED`
  - `FORBIDDEN`
  - `APPLICATION_NOT_FOUND`
  - `APPLICATION_NOT_SUBMITTED`
  - `SUPPLEMENT_SNAPSHOT_LOAD_FAILED`
- Example：

请求：

```http
GET /api/applications/app_001/material-supplement
Cookie: autohire_session=...
```

响应：

```json
{
  "applicationId": "app_001",
  "summary": {
    "materialSupplementStatus": "REVIEWING",
    "latestReviewRunId": "run_001",
    "latestReviewedAt": null,
    "pendingRequestCount": 0,
    "satisfiedRequestCount": 0,
    "remainingReviewRounds": 2
  },
  "categories": [
    {
      "category": "IDENTITY",
      "label": "Identity Documents",
      "status": "REVIEWING",
      "isReviewing": true,
      "latestCategoryReviewId": "cat_review_001",
      "latestReviewedAt": null,
      "aiMessage": "The identity documents are being reviewed.",
      "pendingRequestCount": 0,
      "requests": [],
      "draftFiles": [],
      "waitingReviewFiles": []
    }
  ]
}
```

## 模块 3：补件文件上传

### API：创建补件上传批次

- Method：`POST`
- Path：`/api/applications/{applicationId}/material-supplement/upload-batches`
- Auth：
  - 专家端 HttpOnly session。
  - session 必须属于当前 `applicationId`。
  - `Application.applicationStatus` 必须为 `SUBMITTED`。
- Request：
  - Path Params：
    - `applicationId`：string，必填。
  - Body：

```json
{
  "category": "EDUCATION"
}
```

- Response：

```json
{
  "uploadBatchId": "batch_001",
  "applicationId": "app_001",
  "category": "EDUCATION",
  "status": "DRAFT",
  "fileCount": 0,
  "createdAt": "2026-05-05T10:00:00.000Z"
}
```

- Error Codes：
  - `UNAUTHORIZED`
  - `FORBIDDEN`
  - `APPLICATION_NOT_FOUND`
  - `APPLICATION_NOT_SUBMITTED`
  - `SUPPLEMENT_CATEGORY_UNSUPPORTED`
  - `SUPPLEMENT_CATEGORY_REVIEWING`
  - `SUPPLEMENT_ROUND_LIMIT_REACHED`
  - `SUPPLEMENT_UPLOAD_BATCH_CREATE_FAILED`
- Example：

请求：

```http
POST /api/applications/app_001/material-supplement/upload-batches
Content-Type: application/json
Cookie: autohire_session=...

{
  "category": "EDUCATION"
}
```

响应：

```json
{
  "uploadBatchId": "batch_001",
  "applicationId": "app_001",
  "category": "EDUCATION",
  "status": "DRAFT",
  "fileCount": 0,
  "createdAt": "2026-05-05T10:00:00.000Z"
}
```

### API：创建补件文件上传凭证

- Method：`POST`
- Path：`/api/applications/{applicationId}/material-supplement/upload-intent`
- Auth：
  - 专家端 HttpOnly session。
  - session 必须属于当前 `applicationId`。
  - `Application.applicationStatus` 必须为 `SUBMITTED`。
- Request：
  - Path Params：
    - `applicationId`：string，必填。
  - Body：

```json
{
  "uploadBatchId": "batch_001",
  "category": "EDUCATION",
  "supplementRequestId": "req_001",
  "fileName": "phd-degree.pdf",
  "fileType": "application/pdf",
  "fileSize": 123456
}
```

字段说明：

- `uploadBatchId`：string，必填。
- `category`：enum，必填，仅支持 `IDENTITY`、`EDUCATION`、`EMPLOYMENT`、`PROJECT`、`PATENT`、`HONOR`。
- `supplementRequestId`：string，可选。是否必须绑定具体 request【待确认】。
- `fileName`：string，必填。
- `fileType`：string，必填，允许类型【待确认】。
- `fileSize`：number，必填，大小限制【待确认】。

- Response：

```json
{
  "uploadId": "upload_001",
  "uploadUrl": "https://storage.example.com/presigned-url",
  "method": "PUT",
  "headers": {
    "Content-Type": "application/pdf"
  },
  "objectKey": "applications/app_001/supplements/EDUCATION/batch_001/phd-degree.pdf",
  "deduped": false
}
```

- Error Codes：
  - `UNAUTHORIZED`
  - `FORBIDDEN`
  - `APPLICATION_NOT_FOUND`
  - `APPLICATION_NOT_SUBMITTED`
  - `SUPPLEMENT_CATEGORY_UNSUPPORTED`
  - `SUPPLEMENT_CATEGORY_REVIEWING`
  - `SUPPLEMENT_ROUND_LIMIT_REACHED`
  - `SUPPLEMENT_UPLOAD_BATCH_NOT_FOUND`
  - `SUPPLEMENT_UPLOAD_BATCH_NOT_DRAFT`
  - `SUPPLEMENT_FILE_TYPE_UNSUPPORTED`
  - `SUPPLEMENT_FILE_SIZE_EXCEEDED`
  - `SUPPLEMENT_FILE_COUNT_EXCEEDED`
  - `SUPPLEMENT_FILE_DUPLICATE`
  - `SUPPLEMENT_UPLOAD_INTENT_FAILED`
- Example：

请求：

```http
POST /api/applications/app_001/material-supplement/upload-intent
Content-Type: application/json
Cookie: autohire_session=...

{
  "uploadBatchId": "batch_001",
  "category": "EDUCATION",
  "supplementRequestId": "req_001",
  "fileName": "phd-degree.pdf",
  "fileType": "application/pdf",
  "fileSize": 123456
}
```

响应：

```json
{
  "uploadId": "upload_001",
  "uploadUrl": "https://storage.example.com/presigned-url",
  "method": "PUT",
  "headers": {
    "Content-Type": "application/pdf"
  },
  "objectKey": "applications/app_001/supplements/EDUCATION/batch_001/phd-degree.pdf",
  "deduped": false
}
```

### API：确认单个补件文件上传

- Method：`POST`
- Path：`/api/applications/{applicationId}/material-supplement/files`
- Auth：
  - 专家端 HttpOnly session。
  - session 必须属于当前 `applicationId`。
- Request：
  - Path Params：
    - `applicationId`：string，必填。
  - Body：

```json
{
  "uploadBatchId": "batch_001",
  "category": "EDUCATION",
  "supplementRequestId": "req_001",
  "fileName": "phd-degree.pdf",
  "fileType": "application/pdf",
  "fileSize": 123456,
  "objectKey": "applications/app_001/supplements/EDUCATION/batch_001/phd-degree.pdf"
}
```

- Response：

```json
{
  "file": {
    "id": "supp_file_001",
    "uploadBatchId": "batch_001",
    "category": "EDUCATION",
    "supplementRequestId": "req_001",
    "fileName": "phd-degree.pdf",
    "fileType": "application/pdf",
    "fileSize": 123456,
    "uploadedAt": "2026-05-05T10:03:00.000Z",
    "status": "DRAFT"
  }
}
```

- Error Codes：
  - `UNAUTHORIZED`
  - `FORBIDDEN`
  - `APPLICATION_NOT_FOUND`
  - `APPLICATION_NOT_SUBMITTED`
  - `SUPPLEMENT_CATEGORY_UNSUPPORTED`
  - `SUPPLEMENT_CATEGORY_REVIEWING`
  - `SUPPLEMENT_UPLOAD_BATCH_NOT_FOUND`
  - `SUPPLEMENT_UPLOAD_BATCH_NOT_DRAFT`
  - `SUPPLEMENT_FILE_DUPLICATE`
  - `SUPPLEMENT_FILE_CONFIRM_FAILED`
- Example：

请求：

```http
POST /api/applications/app_001/material-supplement/files
Content-Type: application/json
Cookie: autohire_session=...

{
  "uploadBatchId": "batch_001",
  "category": "EDUCATION",
  "supplementRequestId": "req_001",
  "fileName": "phd-degree.pdf",
  "fileType": "application/pdf",
  "fileSize": 123456,
  "objectKey": "applications/app_001/supplements/EDUCATION/batch_001/phd-degree.pdf"
}
```

响应：

```json
{
  "file": {
    "id": "supp_file_001",
    "uploadBatchId": "batch_001",
    "category": "EDUCATION",
    "supplementRequestId": "req_001",
    "fileName": "phd-degree.pdf",
    "fileType": "application/pdf",
    "fileSize": 123456,
    "uploadedAt": "2026-05-05T10:03:00.000Z",
    "status": "DRAFT"
  }
}
```

### API：删除草稿补件文件

- Method：`DELETE`
- Path：`/api/applications/{applicationId}/material-supplement/files/{fileId}`
- Auth：
  - 专家端 HttpOnly session。
  - session 必须属于当前 `applicationId`。
- Request：
  - Path Params：
    - `applicationId`：string，必填。
    - `fileId`：string，必填。
  - Body：无。
- Response：

```json
{
  "deleted": true,
  "fileId": "supp_file_001",
  "uploadBatchId": "batch_001"
}
```

- Error Codes：
  - `UNAUTHORIZED`
  - `FORBIDDEN`
  - `APPLICATION_NOT_FOUND`
  - `SUPPLEMENT_FILE_NOT_FOUND`
  - `SUPPLEMENT_FILE_NOT_DRAFT`
  - `SUPPLEMENT_CATEGORY_REVIEWING`
  - `SUPPLEMENT_FILE_DELETE_FAILED`
- Example：

请求：

```http
DELETE /api/applications/app_001/material-supplement/files/supp_file_001
Cookie: autohire_session=...
```

响应：

```json
{
  "deleted": true,
  "fileId": "supp_file_001",
  "uploadBatchId": "batch_001"
}
```

### API：确认补件上传批次并触发类别审查

- Method：`POST`
- Path：`/api/applications/{applicationId}/material-supplement/upload-batches/{batchId}/confirm`
- Auth：
  - 专家端 HttpOnly session。
  - session 必须属于当前 `applicationId`。
  - `Application.applicationStatus` 必须为 `SUBMITTED`。
- Request：
  - Path Params：
    - `applicationId`：string，必填。
    - `batchId`：string，必填。
  - Body：

```json
{
  "category": "EDUCATION"
}
```

- Response：

```json
{
  "uploadBatchId": "batch_001",
  "applicationId": "app_001",
  "category": "EDUCATION",
  "fileCount": 3,
  "reviewRunId": "run_002",
  "status": "REVIEWING"
}
```

- Error Codes：
  - `UNAUTHORIZED`
  - `FORBIDDEN`
  - `APPLICATION_NOT_FOUND`
  - `APPLICATION_NOT_SUBMITTED`
  - `SUPPLEMENT_CATEGORY_UNSUPPORTED`
  - `SUPPLEMENT_CATEGORY_REVIEWING`
  - `SUPPLEMENT_ROUND_LIMIT_REACHED`
  - `SUPPLEMENT_UPLOAD_BATCH_NOT_FOUND`
  - `SUPPLEMENT_UPLOAD_BATCH_EMPTY`
  - `SUPPLEMENT_UPLOAD_BATCH_NOT_DRAFT`
  - `SUPPLEMENT_FILE_COUNT_EXCEEDED`
  - `SUPPLEMENT_REVIEW_TRIGGER_FAILED`
  - `MATERIAL_REVIEW_BACKEND_UNAVAILABLE`
- Example：

请求：

```http
POST /api/applications/app_001/material-supplement/upload-batches/batch_001/confirm
Content-Type: application/json
Cookie: autohire_session=...

{
  "category": "EDUCATION"
}
```

响应：

```json
{
  "uploadBatchId": "batch_001",
  "applicationId": "app_001",
  "category": "EDUCATION",
  "fileCount": 2,
  "reviewRunId": "run_002",
  "status": "REVIEWING"
}
```

## 模块 4：审查运行与同步

### API：获取审查运行状态

- Method：`GET`
- Path：`/api/applications/{applicationId}/material-supplement/reviews/{reviewRunId}`
- Auth：
  - 专家端 HttpOnly session。
  - session 必须属于当前 `applicationId`。
- Request：
  - Path Params：
    - `applicationId`：string，必填。
    - `reviewRunId`：string，必填。
  - Body：无。
- Response：

```json
{
  "reviewRunId": "run_002",
  "applicationId": "app_001",
  "runNo": 2,
  "status": "PROCESSING",
  "triggerType": "SUPPLEMENT_UPLOAD",
  "triggeredCategory": "EDUCATION",
  "startedAt": "2026-05-05T10:05:00.000Z",
  "finishedAt": null,
  "categories": [
    {
      "category": "EDUCATION",
      "status": "PROCESSING",
      "isLatest": true
    }
  ]
}
```

- Error Codes：
  - `UNAUTHORIZED`
  - `FORBIDDEN`
  - `APPLICATION_NOT_FOUND`
  - `SUPPLEMENT_REVIEW_RUN_NOT_FOUND`
  - `SUPPLEMENT_REVIEW_STATUS_LOAD_FAILED`
- Example：

请求：

```http
GET /api/applications/app_001/material-supplement/reviews/run_002
Cookie: autohire_session=...
```

响应：

```json
{
  "reviewRunId": "run_002",
  "applicationId": "app_001",
  "runNo": 2,
  "status": "COMPLETED",
  "triggerType": "SUPPLEMENT_UPLOAD",
  "triggeredCategory": "EDUCATION",
  "startedAt": "2026-05-05T10:05:00.000Z",
  "finishedAt": "2026-05-05T10:08:00.000Z",
  "categories": [
    {
      "category": "EDUCATION",
      "status": "COMPLETED",
      "isLatest": true
    }
  ]
}
```

### API：同步审查运行结果

- Method：`POST`
- Path：`/api/applications/{applicationId}/material-supplement/reviews/{reviewRunId}/sync`
- Auth：
  - 专家端 HttpOnly session 或服务端内部调用【待确认】。
  - 若由专家端触发轮询同步，仍需校验 session。
  - 若由服务端定时任务触发，需内部鉴权【待确认】。
- Request：
  - Path Params：
    - `applicationId`：string，必填。
    - `reviewRunId`：string，必填。
  - Body：空对象。
- Response：

```json
{
  "reviewRunId": "run_002",
  "status": "COMPLETED",
  "synced": true,
  "updatedCategories": ["EDUCATION"]
}
```

- Error Codes：
  - `UNAUTHORIZED`
  - `FORBIDDEN`
  - `APPLICATION_NOT_FOUND`
  - `SUPPLEMENT_REVIEW_RUN_NOT_FOUND`
  - `MATERIAL_REVIEW_BACKEND_UNAVAILABLE`
  - `SUPPLEMENT_REVIEW_SYNC_FAILED`
  - `SUPPLEMENT_REVIEW_RESULT_INVALID`
- Example：

请求：

```http
POST /api/applications/app_001/material-supplement/reviews/run_002/sync
Content-Type: application/json
Cookie: autohire_session=...

{}
```

响应：

```json
{
  "reviewRunId": "run_002",
  "status": "COMPLETED",
  "synced": true,
  "updatedCategories": ["EDUCATION"]
}
```

## 模块 5：补件历史

### API：获取补件审查历史

- Method：`GET`
- Path：`/api/applications/{applicationId}/material-supplement/history`
- Auth：
  - 专家端 HttpOnly session。
  - session 必须属于当前 `applicationId`。
  - `Application.applicationStatus` 必须为 `SUBMITTED`。
- Request：
  - Path Params：
    - `applicationId`：string，必填。
  - Query Params：
    - `category`：string，可选。仅支持 6 个审查类别，非法值建议忽略并返回全部。
    - `runNo`：number，可选。非法值建议忽略并返回全部。
- Response：

```json
{
  "applicationId": "app_001",
  "filters": {
    "category": "EDUCATION",
    "runNo": null
  },
  "items": [
    {
      "reviewRunId": "run_002",
      "runNo": 2,
      "category": "EDUCATION",
      "categoryReviewId": "cat_review_002",
      "status": "COMPLETED",
      "isLatest": true,
      "reviewedAt": "2026-05-05T10:08:00.000Z",
      "aiMessage": "The uploaded doctoral degree certificate satisfies the education proof requirement.",
      "files": [
        {
          "id": "supp_file_001",
          "fileName": "phd-degree.pdf",
          "fileType": "application/pdf",
          "fileSize": 123456,
          "uploadedAt": "2026-05-05T10:03:00.000Z"
        }
      ],
      "requests": [
        {
          "id": "req_001",
          "title": "Doctoral degree proof required",
          "status": "SATISFIED",
          "isSatisfied": true,
          "reason": "The latest uploaded file confirms the doctoral degree.",
          "aiMessage": "This requirement has been satisfied."
        }
      ]
    }
  ]
}
```

- Error Codes：
  - `UNAUTHORIZED`
  - `FORBIDDEN`
  - `APPLICATION_NOT_FOUND`
  - `APPLICATION_NOT_SUBMITTED`
  - `SUPPLEMENT_HISTORY_LOAD_FAILED`
- Example：

请求：

```http
GET /api/applications/app_001/material-supplement/history?category=EDUCATION
Cookie: autohire_session=...
```

响应：

```json
{
  "applicationId": "app_001",
  "filters": {
    "category": "EDUCATION",
    "runNo": null
  },
  "items": [
    {
      "reviewRunId": "run_001",
      "runNo": 1,
      "category": "EDUCATION",
      "categoryReviewId": "cat_review_001",
      "status": "COMPLETED",
      "isLatest": false,
      "reviewedAt": "2026-05-05T09:30:00.000Z",
      "aiMessage": "Please provide proof of the doctoral degree listed in your CV.",
      "files": [],
      "requests": [
        {
          "id": "req_001",
          "title": "Doctoral degree proof required",
          "status": "HISTORY_ONLY",
          "isSatisfied": false,
          "reason": "The submitted documents do not clearly prove the doctoral degree listed in the CV.",
          "aiMessage": "Please upload a doctoral degree certificate or an equivalent education verification document."
        }
      ]
    }
  ]
}
```

## 模块 6：内部审查结果写入

### API：外部 AI 审查后端回调写入结果

- Method：`POST`
- Path：`/api/internal/material-supplement/reviews/{reviewRunId}/callback`
- Auth：
  - 内部服务鉴权。
  - 鉴权方式【待确认】。
  - 建议使用服务端 API key + 签名 + 时间戳。
- Request：
  - Path Params：
    - `reviewRunId`：string，必填。
  - Headers：
    - `X-Material-Review-Signature`：string，【待确认】。
    - `X-Material-Review-Timestamp`：string，【待确认】。
  - Body：

```json
{
  "externalRunId": "external_run_001",
  "status": "COMPLETED",
  "finishedAt": "2026-05-05T10:08:00.000Z",
  "categories": [
    {
      "category": "EDUCATION",
      "status": "COMPLETED",
      "aiMessage": "Please provide proof of the doctoral degree listed in your CV.",
      "resultPayload": {
        "supplementRequired": true,
        "requests": [
          {
            "title": "Doctoral degree proof required",
            "reason": "The submitted documents do not clearly prove the doctoral degree listed in the CV.",
            "suggestedMaterials": [
              "Doctoral degree certificate",
              "Education verification report"
            ],
            "aiMessage": "Please upload a doctoral degree certificate or an equivalent education verification document.",
            "status": "PENDING"
          }
        ]
      },
      "rawResultPayload": null
    }
  ]
}
```

- Response：

```json
{
  "reviewRunId": "run_001",
  "accepted": true,
  "status": "COMPLETED",
  "updatedCategories": ["EDUCATION"]
}
```

- Error Codes：
  - `INTERNAL_UNAUTHORIZED`
  - `INTERNAL_SIGNATURE_INVALID`
  - `INTERNAL_TIMESTAMP_INVALID`
  - `SUPPLEMENT_REVIEW_RUN_NOT_FOUND`
  - `SUPPLEMENT_REVIEW_CALLBACK_STALE`
  - `SUPPLEMENT_REVIEW_CALLBACK_DUPLICATE`
  - `SUPPLEMENT_REVIEW_RESULT_INVALID`
  - `SUPPLEMENT_REVIEW_RESULT_SAVE_FAILED`
- Example：

请求：

```http
POST /api/internal/material-supplement/reviews/run_001/callback
Content-Type: application/json
X-Material-Review-Signature: signature-value
X-Material-Review-Timestamp: 2026-05-05T10:08:05.000Z

{
  "externalRunId": "external_run_001",
  "status": "COMPLETED",
  "finishedAt": "2026-05-05T10:08:00.000Z",
  "categories": [
    {
      "category": "EDUCATION",
      "status": "COMPLETED",
      "aiMessage": "Please provide proof of the doctoral degree listed in your CV.",
      "resultPayload": {
        "supplementRequired": true,
        "requests": [
          {
            "title": "Doctoral degree proof required",
            "reason": "The submitted documents do not clearly prove the doctoral degree listed in the CV.",
            "suggestedMaterials": [
              "Doctoral degree certificate",
              "Education verification report"
            ],
            "aiMessage": "Please upload a doctoral degree certificate or an equivalent education verification document.",
            "status": "PENDING"
          }
        ]
      },
      "rawResultPayload": null
    }
  ]
}
```

响应：

```json
{
  "reviewRunId": "run_001",
  "accepted": true,
  "status": "COMPLETED",
  "updatedCategories": ["EDUCATION"]
}
```

## 模块 7：通用错误响应

### API：通用错误结构

- Method：不适用
- Path：不适用
- Auth：不适用
- Request：不适用
- Response：

所有接口错误建议统一返回：

```json
{
  "error": {
    "code": "SUPPLEMENT_CATEGORY_REVIEWING",
    "message": "This category is currently under review. Please wait until the review is complete.",
    "details": {
      "category": "EDUCATION"
    }
  }
}
```

- Error Codes：
  - 见各接口。
- Example：

```json
{
  "error": {
    "code": "SUPPLEMENT_FILE_COUNT_EXCEEDED",
    "message": "You can upload up to 10 files for one category at a time.",
    "details": {
      "maxFiles": 10,
      "receivedFiles": 12
    }
  }
}
```

## 待确认项

1. 补件页面是否最终使用 `/apply/supplement`。
2. 补件文件是否必须绑定具体 `supplementRequestId`。
3. 上传文件允许类型。
4. 上传文件大小限制。
5. 文件存储 upload intent 的最终响应字段。
6. 外部 AI 审查后端是回调写入，还是当前项目轮询同步。
7. 内部回调鉴权方式。
8. 外部后端返回的 `resultPayload` 最终结构。
9. 审查结果缓存命中时是否仍创建历史 run。
10. 草稿 upload batch 是否需要取消接口。
