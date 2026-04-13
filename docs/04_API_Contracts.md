# 04 API Contracts

## 当前状态（2026-04-11）

- 当前接口契约已按代码实现更新为“upload intent + confirm”两步上传模式
- 当前资格通过后的流程已更新为“详细分析完成后再进入材料上传”
- 当前 `expert-session`、`resume`、`materials`、`submit` 已在真实 PostgreSQL 模式下验证通过
- 当前阿里云 OSS 预签名 `PUT` 上传已完成服务端联调验证
- 当前 live 简历分析适配层已改为对接既有 `resume-process` 上传与详情接口
- 当前“受控下载 / 受控预览”接口尚未补齐，仍为后续切片

## 1. 专家会话与申请初始化

### GET `/api/expert-session`

用途：通过 `token` 初始化专家会话并恢复申请状态

请求参数：

- `token`

响应示例：

```json
{
  "applicationId": "app_001",
  "expertId": "exp_001",
  "invitationId": "inv_001",
  "applicationStatus": "INFO_REQUIRED",
  "currentStep": "supplemental_fields",
  "eligibilityResult": "INSUFFICIENT_INFO",
  "resumeAnalysisStatus": "COMPLETED",
  "latestResumeFile": {
    "id": "resume_001",
    "fileName": "candidate.pdf",
    "fileType": "application/pdf",
    "fileSize": 123456,
    "uploadedAt": "2026-04-11T09:00:00.000Z"
  },
  "latestResult": {
    "displaySummary": "当前无法完成资格判断，缺少关键信息。",
    "reasonText": "缺少最高学历与当前工作单位信息。",
    "missingFields": [
      {
        "fieldKey": "highest_degree",
        "sourceItemName": "最高学位",
        "label": "最高学历",
        "type": "select",
        "required": true,
        "options": ["本科", "硕士", "博士", "其他"]
      }
    ],
    "extractedFields": {
      "name": "Jane Doe"
    }
  },
  "uploadedMaterialsSummary": {
    "identity": 0,
    "employment": 0,
    "education": 0,
    "honor": 0,
    "patent": 0,
    "project": 0
  },
  "submittedAt": null
}
```

## 2. 进入正式流程

### POST `/api/applications/{applicationId}/intro/confirm`

用途：记录已开始申请

响应：

```json
{
  "applicationId": "app_001",
  "applicationStatus": "INTRO_VIEWED",
  "currentStep": "resume"
}
```

## 3. 申请简历上传 intent

### POST `/api/applications/{applicationId}/resume/upload-intent`

用途：申请简历对象存储上传凭证

请求示例：

```json
{
  "fileName": "candidate.pdf",
  "fileType": "application/pdf",
  "fileSize": 123456
}
```

响应示例：

```json
{
  "uploadUrl": "https://hirebucket.oss-cn-wuhan-lr.aliyuncs.com/...",
  "method": "PUT",
  "headers": {
    "Content-Type": "application/pdf"
  },
  "objectKey": "applications/app_001/resume/1775869200000-candidate.pdf"
}
```

## 4. 确认简历上传并触发分析

### POST `/api/applications/{applicationId}/resume`

当前实现说明：

- 路由仍保留为“确认上传并触发首次分析”的语义
- 别名路由 `/api/applications/{applicationId}/resume/confirm` 也可用
- 若 live 上游建任务失败，返回 `502`，当前申请保持在 `CV_UPLOADED`

响应：

```json
{
  "applicationId": "app_001",
  "analysisJobId": "job_001",
  "applicationStatus": "CV_ANALYZING"
}
```

## 5. 查询分析状态

### GET `/api/applications/{applicationId}/analysis-status`

响应：

```json
{
  "applicationId": "app_001",
  "jobStatus": "PROCESSING",
  "stageText": "正在判断申报资格",
  "progressMessage": "请稍候，系统正在分析您的简历信息。"
}
```

## 6. 获取分析结果

### GET `/api/applications/{applicationId}/analysis-result`

响应：

```json
{
  "applicationId": "app_001",
  "eligibilityResult": "INSUFFICIENT_INFO",
  "displaySummary": "当前无法完成资格判断，缺少关键信息。",
  "reasonText": "缺少最高学历与当前工作单位信息。",
  "extractedFields": {
    "name": "Jane Doe"
  },
  "missingFields": [
    {
      "fieldKey": "highest_degree",
      "sourceItemName": "最高学位",
      "label": "最高学历",
      "type": "select",
      "required": true,
      "options": ["本科", "硕士", "博士", "其他"],
      "helpText": "请填写已获得的最高学历"
    },
    {
      "fieldKey": "current_employer",
      "sourceItemName": "当前工作单位",
      "label": "当前工作单位",
      "type": "text",
      "required": true
    }
  ],
  "applicationStatus": "INFO_REQUIRED",
  "resumeAnalysisStatus": "COMPLETED"
}
```

## 7. 提交补充字段并二次分析

### POST `/api/applications/{applicationId}/supplemental-fields`

请求示例：

```json
{
  "fields": {
    "highest_degree": "博士",
    "current_employer": "Example University"
  }
}
```

实现说明：

- 前端请求体仍保持 `{ "fields": { ... } }`
- 后端落库时会额外保存：
  - `valuesByFieldKey`
  - `valuesBySourceItemName`
  - `fieldMeta`
  - `missingFieldsSnapshot`
- 这样后续新增缺失项或接入正式重分析接口时，无需改动前端请求体
- 若 live 上游重新分析建任务失败，返回 `502`，当前申请保持在 `INFO_REQUIRED`

响应：

```json
{
  "applicationId": "app_001",
  "analysisJobId": "job_002",
  "applicationStatus": "REANALYZING"
}
```

## 8. 申请材料上传 intent

### POST `/api/applications/{applicationId}/materials/upload-intent`

用途：申请分类材料对象存储上传凭证

请求示例：

```json
{
  "category": "IDENTITY",
  "fileName": "passport.pdf",
  "fileType": "application/pdf",
  "fileSize": 456789
}
```

响应示例：

```json
{
  "uploadUrl": "https://hirebucket.oss-cn-wuhan-lr.aliyuncs.com/...",
  "method": "PUT",
  "headers": {
    "Content-Type": "application/pdf"
  },
  "objectKey": "applications/app_001/materials/IDENTITY/1775869201000-passport.pdf"
}
```

## 9. 获取材料快照

### GET `/api/applications/{applicationId}/materials`

响应示例：

```json
{
  "identity": [
    {
      "id": "mat_001",
      "fileName": "passport.pdf",
      "fileType": "application/pdf",
      "fileSize": 456789,
      "uploadedAt": "2026-04-11T09:10:00.000Z",
      "category": "IDENTITY"
    }
  ],
  "employment": [],
  "education": [],
  "honor": [],
  "patent": [],
  "project": []
}
```

## 10. 确认材料上传

### POST `/api/applications/{applicationId}/materials`

用途：确认材料上传成功并登记元数据

请求示例：

```json
{
  "category": "IDENTITY",
  "fileName": "passport.pdf",
  "fileType": "application/pdf",
  "fileSize": 456789,
  "objectKey": "applications/app_001/materials/IDENTITY/1775869201000-passport.pdf"
}
```

响应：

```json
{
  "identity": [
    {
      "id": "mat_001",
      "fileName": "passport.pdf",
      "fileType": "application/pdf",
      "fileSize": 456789,
      "uploadedAt": "2026-04-11T09:10:00.000Z",
      "category": "IDENTITY"
    }
  ],
  "employment": [],
  "education": [],
  "honor": [],
  "patent": [],
  "project": []
}
```

说明：

- 当前响应不会回传底层对象存储地址
- 当前仅回传受控所需的材料摘要字段

## 11. 进入材料上传阶段

### POST `/api/applications/{applicationId}/materials/enter`

用途：在详细分析完成后，显式进入材料上传阶段。

实现说明：

- 仅当 `applicationStatus=SECONDARY_REVIEW` 时允许调用
- 成功后状态推进为 `MATERIALS_IN_PROGRESS`

响应示例：

```json
{
  "applicationId": "app_001",
  "applicationStatus": "MATERIALS_IN_PROGRESS",
  "currentStep": "materials",
  "nextRoute": "/apply/materials"
}
```

## 12. 删除材料

### DELETE `/api/applications/{applicationId}/materials/{fileId}`

响应：

```json
{
  "identity": [],
  "employment": [],
  "education": [],
  "honor": [],
  "patent": [],
  "project": []
}
```

## 13. 最终提交

实现说明：

- 仅当 `applicationStatus=MATERIALS_IN_PROGRESS` 时允许提交
- 若当前已是 `SUBMITTED`，仍返回幂等成功响应

### POST `/api/applications/{applicationId}/submit`

响应：

```json
{
  "applicationId": "app_001",
  "applicationStatus": "SUBMITTED",
  "message": "已收到材料信息，将在 1-3 个工作日内答复。"
}
```

## 14. live 简历分析适配说明

当前专家端公开接口不直接透传上游 `resume-process` 结构，内部适配规则如下：

- 首次分析创建：
  - `POST {RESUME_ANALYSIS_BASE_URL}/resume-process/upload`
  - 请求体为 `multipart/form-data`
  - 字段名使用 `file`
- 状态轮询 / 结果读取：
  - `GET {RESUME_ANALYSIS_BASE_URL}/resume-process/jobs/{jobId}`
  - 读取 `job.status` 与 `initial_result`
- 补填后二次分析：
  - `POST {RESUME_ANALYSIS_REANALYZE_PATH}`
  - 默认模板路径：
    `/internal/resume-analysis/jobs/{jobId}/reanalyze`
  - 请求体仍使用补填后的结构化字段值

适配说明：

- `job.status` 会被映射到：
  - `pending` / `queued` -> `QUEUED`
  - `processing` / `retrying` -> `PROCESSING`
  - `completed` -> `COMPLETED`
  - `failed` -> `FAILED`
- 若 `job.status=completed` 但 `initial_result` 尚未可用：
  - 专家端仍返回 `PROCESSING`
  - `stageText=正在同步分析结果`
- live 结果会优先解析首次判断正文中的：
  - `[[[...]]]`：内部推理块
  - `{{{...}}}`：正式结论
  - `!!!信息项名称!!!`：缺失项列表
- 专家端 `missingFields` 以 `!!!...!!!` 解析结果为准
- `extractedFields` 用于展示“已识别信息摘要”，前端会按旧项目字段规则做隐藏、标题改名和默认值清洗
- 状态轮询遇到上游超时、网络错误、429、5xx 时，当前任务不会立刻置为失败，而是继续维持轮询态

## 15. 当前未完成接口

- 受控下载 / 受控预览接口仍未补齐
- 当前前端不直接持有底层存储地址
- 真实上游服务的联通验证仍依赖正确配置：
  - `RESUME_ANALYSIS_MODE=live`
  - `RESUME_ANALYSIS_BASE_URL`
  - `RESUME_ANALYSIS_API_KEY`
  - `RESUME_ANALYSIS_REANALYZE_PATH`（若上游未使用默认路径）

## 16. 触发进一步分析（secondary analysis）

实现说明补充：

- 资格初审通过后，专家端仅显示详细分析入口，不再直接进入材料上传页
- 详细分析完成后会先停留在结果页，待专家点击继续后再进入材料上传

### POST `/api/applications/{applicationId}/secondary-analysis`

用途：基于当前申请最近一次分析任务，触发既有 `resume-process` 的二次分析流程。

实现说明：

- 当前路由会先校验专家会话与申请归属
- 内部会读取当前申请最新 `analysis_job.external_job_id`
- 然后调用上游：
  - `POST {RESUME_ANALYSIS_BASE_URL}/resume-process/jobs/{externalJobId}/trigger-secondary`
- 二次分析当前只允许触发一次；若当前申请已存在 `secondary_analysis_run`，接口返回 `409`

响应示例：

```json
{
  "applicationId": "app_001",
  "runId": "123",
  "status": "pending"
}
```

重复触发响应示例：

```json
{
  "error": {
    "message": "Secondary analysis has already been started for this application.",
    "code": "SECONDARY_ANALYSIS_ALREADY_STARTED"
  }
}
```

## 17. 查询进一步分析结果

### GET `/api/applications/{applicationId}/secondary-analysis/result`

可选查询参数：

- `runId`

用途：读取上游 `resume-process` 二次分析状态与结果，并在专家端返回已过滤、可直接展示的字段列表。

实现说明：

- 当前内部通过上游：
  - `GET {RESUME_ANALYSIS_BASE_URL}/resume-process/jobs/{externalJobId}?run_id={runId}`
- 读取：
  - `job.secondary_status`
  - `job.secondary_error_message`
  - `secondary_run`
  - `secondary_results[].generated_text`
- 专家端按 `NO.{n}###` 规则解析字段
- 当前展示时会隐藏以下字段：`8/9/10/11/28/30/31/34`
- 当前展示时会做占位值清洗：
  - `1900-01-01` / `1900/01/01` -> 空
  - `无+客户号` -> 空
- `NO.29` 展示文案统一改为：
  `是否曾入选过中国省级或国家级人才计划（若是请填写计划名称及年份）`
- 当前结果接口继续返回只读投影，仅包含非空 `effectiveValue`
- 若专家已人工修订字段，则返回人工保存后的 `effectiveValue`

响应示例：

```json
{
  "applicationId": "app_001",
  "runId": "123",
  "status": "completed",
  "errorMessage": null,
  "run": {
    "id": "123",
    "status": "completed",
    "totalPrompts": 2,
    "completedPrompts": 2,
    "failedPromptIds": [],
    "errorMessage": null
  },
  "fields": [
    {
      "no": 1,
      "column": "K",
      "label": "*姓名",
      "value": "Jane Doe"
    },
    {
      "no": 29,
      "column": "AM",
      "label": "是否曾入选过中国省级或国家级人才计划（若是请填写计划名称及年份）",
      "value": "国家级人才计划（2023）"
    }
  ]
}
```

## 18. 获取可编辑的二次分析字段

### GET `/api/applications/{applicationId}/secondary-analysis/editable`

可选查询参数：

- `runId`

用途：返回完整的专家可编辑二次分析快照，包括模型原值、人工覆盖值、最终生效值，以及缺失/编辑状态。

实现说明：

- 若当前申请尚未触发二次分析，返回 `status=idle` 且 `fields=[]`
- 返回字段列表包含完整专家侧字段，而不只返回非空字段
- `effectiveValue` 计算规则为：
  - `hasOverride=true` 时取 `editedValue`
  - 否则取 `sourceValue`
- 因此专家可以显式把字段保存为空，而不会自动回退到模型值

响应示例：

```json
{
  "applicationId": "app_001",
  "runId": "123",
  "status": "completed",
  "errorMessage": null,
  "missingCount": 2,
  "savedAt": "2026-04-13T03:50:00.000Z",
  "run": {
    "id": "123",
    "status": "completed",
    "totalPrompts": 2,
    "completedPrompts": 2,
    "failedPromptIds": [],
    "errorMessage": null
  },
  "fields": [
    {
      "no": 15,
      "fieldKey": "highest_degree",
      "column": "Y",
      "label": "Highest Degree",
      "inputType": "select",
      "options": ["Bachelor's", "Master's", "Doctorate", "Other"],
      "sourceValue": "Doctorate",
      "editedValue": "Master's",
      "effectiveValue": "Master's",
      "hasOverride": true,
      "isMissing": false,
      "isEdited": true,
      "savedAt": "2026-04-13T03:50:00.000Z"
    },
    {
      "no": 32,
      "fieldKey": "research_direction",
      "column": "AQ",
      "label": "Research Direction",
      "inputType": "textarea",
      "sourceValue": "",
      "editedValue": "Marine biotechnology",
      "effectiveValue": "Marine biotechnology",
      "hasOverride": true,
      "isMissing": false,
      "isEdited": true,
      "savedAt": "2026-04-13T03:50:00.000Z"
    }
  ]
}
```

## 19. 保存可编辑的二次分析字段

### POST `/api/applications/{applicationId}/secondary-analysis/save`

用途：批量保存专家对二次分析字段的修改或空值补填。

请求示例：

```json
{
  "runId": "123",
  "fields": {
    "highest_degree": {
      "value": "Master's",
      "hasOverride": true
    },
    "32": {
      "value": "Marine biotechnology",
      "hasOverride": true
    }
  }
}
```

实现说明：

- `fields` 的 key 既支持 `fieldKey`，也支持字段序号 `no`
- `hasOverride=false` 表示清除人工覆盖，恢复使用模型值
- 保存动作不会改动 `application_status`、`eligibility_result`，也不会自动推进流程
- 保存后的响应结构与 `editable` 接口一致

错误示例：

```json
{
  "error": {
    "message": "The provided secondary analysis field is not supported.",
    "code": "SECONDARY_ANALYSIS_FIELD_UNSUPPORTED"
  }
}
```
