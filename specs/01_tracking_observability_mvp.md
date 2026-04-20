# Tracking And Observability MVP

## 1. 目标

- 建立专家申请流程的首版全链路埋点体系，覆盖邀约访问、页面浏览、按钮点击、上传尝试、分析流程、提交行为。
- 支持直接计算以下核心指标：
  - Invite 链接 UV/PV
  - 无效链接率、过期链接率、禁用链接率
  - 各阶段转化率
  - 各阶段耗时
  - 简历/材料上传成功率与失败率
  - IP 维度异常访问监控

## 2. 范围

- 包含服务端事件
- 包含前端页面浏览与按钮点击事件
- 前端统一调用 `POST /api/track`
- 事件实时落 PostgreSQL
- 事件归属口径：
  - `session_id` 必有
  - `invitation_id` 尽量有
  - `application_id` 在恢复成功后补齐

## 3. 数据设计

### 3.1 新增 `InviteAccessLog`

用途：记录 invite 链接访问、无效/过期/禁用 token、session restore 等入口级访问事件。

字段建议：

- `id`
- `occurred_at`
- `invitation_id?`
- `application_id?`
- `token_status`
- `access_result`：`valid | invalid | expired | disabled | session_restore`
- `ip_hash`
- `user_agent`
- `referer`
- `landing_path`
- `session_id`
- `request_id`
- `utm_source`
- `utm_medium`
- `utm_campaign`

### 3.2 扩展 `ApplicationEventLog`

用途：记录已进入申请流程后的业务事件与页面事件。

保留原有字段：

- `id`
- `application_id`
- `event_type`
- `event_payload`

新增字段：

- `event_time`
- `page_name`
- `step_name`
- `action_name`
- `event_status`：`success | fail`
- `error_code`
- `error_message`
- `duration_ms`
- `session_id`
- `request_id`
- `ip_hash`
- `user_agent`
- `referer`

### 3.3 扩展 `Application`

新增里程碑字段：

- `first_accessed_at`
- `last_accessed_at`
- `intro_confirmed_at`
- `resume_upload_started_at`
- `resume_uploaded_at`
- `analysis_started_at`
- `analysis_completed_at`
- `materials_entered_at`
- `submitted_at`

设计原则：

- 这些字段作为便于统计的派生真源
- 事件流用于审计，里程碑字段用于高频报表与阶段耗时计算

### 3.4 新增 `FileUploadAttempt`

用途：记录上传尝试，不只记录成功。

字段建议：

- `id`
- `application_id`
- `kind`：`resume | material`
- `category?`
- `file_name`
- `file_ext`
- `file_size`
- `intent_created_at`
- `upload_started_at`
- `upload_confirmed_at`
- `upload_failed_at`
- `failure_code`
- `failure_stage`：`intent | put | confirm`
- `duration_ms`
- `object_key`

## 4. 关键事件字典

### 4.1 入口层

- `invite_link_opened`
- `session_restored`
- `invite_link_invalid`
- `invite_link_expired`
- `invite_link_disabled`

### 4.2 申请流程层

- `intro_page_viewed`
- `start_apply_clicked`
- `resume_page_viewed`
- `resume_upload_intent_created`
- `resume_upload_started`
- `resume_upload_confirmed`
- `resume_upload_failed`
- `analysis_result_viewed`
- `supplemental_submitted`
- `secondary_analysis_triggered`
- `materials_page_viewed`
- `material_upload_intent_created`
- `material_upload_started`
- `material_upload_confirmed`
- `material_upload_failed`
- `submit_clicked`
- `application_submitted`

## 5. 用户故事

- As 运营, I want to know invite UV/PV and invalid-link rate, so that I can evaluate channel quality.
- As 风控, I want to monitor IP-level access patterns and disabled/expired token traffic, so that I can detect abnormal activity.
- As 产品经理, I want to see page funnel and stage conversion, so that I can locate drop-off points.
- As 工程/客服, I want to know exactly where uploads fail, so that I can diagnose user issues quickly.

## 6. 验收标准

- 无效/过期/禁用 token 访问可落库，不依赖 `application_id`
- 页面浏览与按钮点击可通过 `POST /api/track` 实时入库
- 上传链路可区分 `intent`、`put`、`confirm`、`fail`
- `Application` 里程碑字段在关键流程中自动更新
- 同一会话可通过 `session_id` 串联入口访问、页面行为和业务事件
- 报表可直接计算：
  - invite UV/PV
  - invalid/expired/disabled rate
  - resume upload success/fail rate
  - application submit conversion
  - stage duration

## 7. 实现假设

- `ip_hash` 使用单向 hash 存储，不保留明文 IP
- `session_id` 在前端首次访问即生成并持久化
- `request_id` 由每次请求生成，用于串联单次调用
- 前端 OSS `PUT` 阶段事件通过浏览器侧埋点上报
- `ApplicationEventLog` 只记录已关联到 `application_id` 的事件，入口未识别流量进入 `InviteAccessLog`
