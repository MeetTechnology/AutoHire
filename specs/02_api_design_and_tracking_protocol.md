# API Design And Tracking Protocol

## 1. API 概览

- 统一埋点入口：`POST /api/track`
- 用途：接收前端页面浏览、按钮点击、上传过程事件，也允许服务端内部复用同一协议写入事件
- 写入目标：
  - 入口级访问事件写入 `InviteAccessLog`
  - 已绑定申请的流程事件写入 `ApplicationEventLog`
  - 上传尝试事件同步写入 `FileUploadAttempt`
  - 命中关键里程碑时同步更新 `Application`

## 2. 鉴权与访问策略

- 前端可匿名调用 `POST /api/track`
- 但请求需尽可能携带以下上下文：
  - `session_id`：必填
  - `request_id`：必填
  - `token`：有则传，用于入口访问识别
  - `application_id`：已恢复申请后传
- 服务端处理原则：
  - 有有效 session 且能恢复 `application` 时，优先绑定 `application_id`
  - 有 token 但无有效申请时，尝试绑定 `invitation_id`
  - token 无效/过期/禁用时，仍允许落 `InviteAccessLog`
- 不要求前端为埋点单独持有额外密钥，避免接入复杂化

## 3. 请求结构

```json
{
  "event_type": "resume_upload_failed",
  "event_time": "2026-04-20T15:30:45.123Z",
  "page_name": "apply_resume",
  "step_name": "resume_upload",
  "action_name": "upload_confirm",
  "event_status": "fail",
  "session_id": "sess_xxx",
  "request_id": "req_xxx",
  "application_id": "app_xxx",
  "token": "optional_invite_token",
  "duration_ms": 1840,
  "error_code": "oss_put_timeout",
  "error_message": "Upload request timed out",
  "referer": "https://example.com/apply",
  "landing_path": "/apply/resume",
  "utm": {
    "source": "email",
    "medium": "invite",
    "campaign": "gesf_2026_batch_1"
  },
  "upload": {
    "kind": "resume",
    "category": null,
    "file_name": "cv.pdf",
    "file_ext": "pdf",
    "file_size": 1024000,
    "failure_stage": "put",
    "object_key": "applications/app_xxx/resume/cv.pdf"
  },
  "payload": {
    "button_name": "retry_upload"
  }
}
```

## 4. 字段协议

### 4.1 必填字段

- `event_type`
- `event_time`
- `session_id`
- `request_id`

### 4.2 推荐字段

- `page_name`
- `step_name`
- `action_name`
- `event_status`
- `application_id`
- `token`
- `referer`
- `landing_path`

### 4.3 扩展字段

- `payload`：保留 JSON 扩展能力，承载按钮名、组件位置、附加上下文
- `utm`：渠道字段
- `upload`：上传链路专用字段

## 5. 事件路由规则

### 5.1 写入 `InviteAccessLog`

- `invite_link_opened`
- `session_restored`
- `invite_link_invalid`
- `invite_link_expired`
- `invite_link_disabled`

### 5.2 写入 `ApplicationEventLog`

- 所有已能绑定 `application_id` 的页面/动作事件

### 5.3 同步写入 `FileUploadAttempt`

- `resume_upload_intent_created`
- `resume_upload_started`
- `resume_upload_confirmed`
- `resume_upload_failed`
- `material_upload_intent_created`
- `material_upload_started`
- `material_upload_confirmed`
- `material_upload_failed`

## 6. 里程碑更新时间规则

- `invite_link_opened` 或首次有效恢复申请：更新 `first_accessed_at`，并刷新 `last_accessed_at`
- 任意已绑定申请的页面/动作事件：刷新 `last_accessed_at`
- `start_apply_clicked` 或介绍确认成功：更新 `intro_confirmed_at`
- `resume_upload_intent_created`：若为空则更新 `resume_upload_started_at`
- `resume_upload_confirmed`：更新 `resume_uploaded_at`
- 分析任务真正创建时：更新 `analysis_started_at`
- 分析结果完成时：更新 `analysis_completed_at`
- `materials_page_viewed` 首次进入：更新 `materials_entered_at`
- `application_submitted`：更新 `submitted_at`

## 7. 幂等与去重

- 首版建议使用 `request_id + event_type` 作为弱幂等键
- 同一 `session_id` 下，若 `request_id + event_type` 已存在，则默认忽略重复写入
- 页面浏览事件可允许短时间重复，但建议前端避免同页面 mount 抖动重复上报
- 上传类事件以阶段推进为准，不要求全局唯一，但同一阶段重复上报应去重

## 8. 返回结构

成功：

```json
{
  "ok": true,
  "accepted": true,
  "event_id": "evt_xxx",
  "bound_context": {
    "invitation_id": "inv_xxx",
    "application_id": "app_xxx"
  }
}
```

失败：

```json
{
  "ok": false,
  "code": "invalid_track_payload",
  "message": "event_type and session_id are required"
}
```

## 9. 错误处理原则

- 埋点失败不得阻塞主业务流程
- 前端对 `POST /api/track` 失败只做静默重试或降级，不打断用户操作
- 服务端记录解析失败、字段缺失、数据库写入失败的内部日志
- 无法解析 `application_id` 时，只要 `session_id` 合法，也应尽量保留入口访问日志

## 10. 前端接入规范

- 页面首屏进入即上报 `*_page_viewed`
- 用户明确点击后再上报 `*_clicked`
- 上传链路按 `intent -> started -> confirmed/failed` 顺序上报
- `session_id` 保存在浏览器本地，跨页面复用
- `request_id` 每次埋点调用重新生成
- 同一事件名必须保持稳定，不允许前后端各自命名

## 11. 验收标准

- 前端页面浏览与按钮点击可实时入库
- 无效 token 访问可落 `InviteAccessLog`
- 已恢复申请的事件可落 `ApplicationEventLog`
- 上传事件可同步驱动 `FileUploadAttempt`
- 关键里程碑时间能由事件自动更新
- 埋点接口异常不会阻塞主流程
