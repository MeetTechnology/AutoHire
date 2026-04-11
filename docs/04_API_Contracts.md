# 04 API Contracts

## 当前状态（2026-04-11）

- 当前接口契约已按代码实现更新为“upload intent + confirm”两步上传模式
- 当前 `expert-session`、`resume`、`materials`、`submit` 已在真实 PostgreSQL 模式下验证通过
- 当前阿里云 OSS 预签名 `PUT` 上传已完成服务端联调验证
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
      "label": "最高学历",
      "type": "select",
      "required": true,
      "options": ["本科", "硕士", "博士", "其他"],
      "helpText": "请填写已获得的最高学历"
    },
    {
      "fieldKey": "current_employer",
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

## 11. 删除材料

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

## 12. 最终提交

### POST `/api/applications/{applicationId}/submit`

响应：

```json
{
  "applicationId": "app_001",
  "applicationStatus": "SUBMITTED",
  "message": "已收到材料信息，将在 1-3 个工作日内答复。"
}
```

## 13. 内部简历分析适配接口

### POST `/internal/resume-analysis/jobs`

用途：创建分析任务

### GET `/internal/resume-analysis/jobs/{jobId}`

用途：查询任务状态

### GET `/internal/resume-analysis/jobs/{jobId}/result`

用途：获取结构化分析结果

## 14. 当前未完成接口

- 受控下载 / 受控预览接口仍未补齐
- 当前前端不直接持有底层存储地址，但仍缺少正式文件读取网关
