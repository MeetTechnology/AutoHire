# 04 API Contracts

## 1. 专家会话与申请初始化

### GET `/api/expert-session`

用途：通过 `token` 初始化专家会话并恢复申请状态

请求参数：

- `token`

响应示例：

```json
{
  "expert_id": "exp_001",
  "application_id": "app_001",
  "application_status": "INFO_REQUIRED",
  "current_step": "supplemental_fields",
  "resume_analysis_status": "completed",
  "eligibility_result": "insufficient_info",
  "missing_fields": [
    {
      "field_key": "highest_degree",
      "label": "最高学历",
      "type": "select",
      "required": true,
      "options": ["本科", "硕士", "博士", "其他"]
    }
  ],
  "uploaded_materials_summary": {
    "identity": 0,
    "employment": 0,
    "education": 0,
    "honor": 0,
    "patent": 0,
    "project": 0
  }
}
```

## 2. 进入正式流程

### POST `/api/applications/{applicationId}/intro/confirm`

用途：记录已开始申请

响应：

```json
{
  "application_status": "INTRO_VIEWED"
}
```

## 3. 上传简历

### POST `/api/applications/{applicationId}/resume`

用途：上传简历并触发首次分析

响应：

```json
{
  "analysis_job_id": "job_001",
  "application_status": "CV_ANALYZING"
}
```

## 4. 查询分析状态

### GET `/api/applications/{applicationId}/analysis-status`

响应：

```json
{
  "job_status": "processing",
  "stage_text": "正在判断申报资格",
  "progress_message": "请稍候，系统正在分析您的简历信息。"
}
```

## 5. 获取分析结果

### GET `/api/applications/{applicationId}/analysis-result`

响应：

```json
{
  "eligibility_result": "insufficient_info",
  "display_summary": "当前无法完成资格判断，缺少关键信息。",
  "reason_text": "缺少最高学历与当前工作单位信息。",
  "extracted_fields": {
    "name": "Jane Doe"
  },
  "missing_fields": [
    {
      "field_key": "highest_degree",
      "label": "最高学历",
      "type": "select",
      "required": true,
      "options": ["本科", "硕士", "博士", "其他"],
      "help_text": "请填写已获得的最高学历"
    },
    {
      "field_key": "current_employer",
      "label": "当前工作单位",
      "type": "text",
      "required": true
    }
  ]
}
```

## 6. 提交补充字段并二次分析

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
  "analysis_job_id": "job_002",
  "application_status": "REANALYZING"
}
```

## 7. 获取材料快照

### GET `/api/applications/{applicationId}/materials`

响应示例：

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

## 8. 上传材料

### POST `/api/applications/{applicationId}/materials`

请求参数：

- `category`
- `files[]`

响应：

```json
{
  "category": "education",
  "files": [
    {
      "file_id": "file_001",
      "file_name": "degree.pdf"
    }
  ]
}
```

## 9. 删除材料

### DELETE `/api/applications/{applicationId}/materials/{fileId}`

响应：

```json
{
  "success": true
}
```

## 10. 最终提交

### POST `/api/applications/{applicationId}/submit`

响应：

```json
{
  "application_status": "SUBMITTED",
  "message": "已收到材料信息，将在 1-3 个工作日内答复。"
}
```

## 11. 内部简历分析适配接口

### POST `/internal/resume-analysis/jobs`

用途：创建分析任务

### GET `/internal/resume-analysis/jobs/{jobId}`

用途：查询任务状态

### GET `/internal/resume-analysis/jobs/{jobId}/result`

用途：获取结构化分析结果
