# Event Dictionary And Field Definitions

## 1. 口径原则

- 事件名使用稳定的 `snake_case` 英文，不带页面文案，不随 UI 语言变化
- 同一事件只表达一个明确动作，不把“浏览 + 点击 + 成功”混在一起
- 页面浏览、按钮点击、服务端确认、上传阶段、异常失败分开建事件
- 能由服务端强校验的事实，以服务端事件为准
- 只能在浏览器准确获取的行为，例如页面曝光、按钮点击、OSS `PUT` 开始与失败，以前端事件为准
- 同一业务动作允许前后端各有一条事件，但职责必须不同

## 2. 公共字段口径

- `event_type`
  - 事件名，必须来自统一字典
- `event_time`
  - 事件实际发生时间，前端生成或服务端生成，统一 ISO 时间
- `page_name`
  - 页面标识，不写 URL 原文
  - 推荐值：`apply_entry`、`apply_resume`、`apply_result`、`apply_materials`
- `step_name`
  - 业务步骤标识
  - 推荐值：`invite_access`、`intro`、`resume_upload`、`analysis_result`、`supplemental`、`secondary_analysis`、`materials`、`submit`
- `action_name`
  - 页面内动作标识
  - 推荐值：`page_view`、`button_click`、`intent_create`、`upload_start`、`upload_confirm`、`upload_fail`、`submit_confirm`
- `event_status`
  - `SUCCESS | FAIL`
  - 只在有明确结果的事件中必填，纯曝光事件可为空或统一写 `SUCCESS`
- `session_id`
  - 同一浏览器会话稳定复用，必须有
- `request_id`
  - 单次请求或单次上报唯一标识，必须有
- `invitation_id`
  - 能识别时写入，不能识别允许为空
- `application_id`
  - 申请恢复成功后必须带上；入口无效 token 场景允许为空
- `ip_hash`
  - 服务端计算并写入，不信任前端直传
- `referer`
  - 来源页 URL 或浏览器 referer
- `landing_path`
  - 用户落地路径，例如 `/apply`、`/apply/resume`
- `duration_ms`
  - 用于上传、接口、分析等待等耗时场景；页面曝光默认不填
- `error_code`
  - 稳定机器码，例如 `token_expired`、`oss_put_timeout`
- `error_message`
  - 面向排障的简短错误描述，不保证用于报表聚合
- `payload`
  - 扩展 JSON，承载按钮位置、组件名、实验分桶等附加信息

## 3. 页面与步骤枚举建议

### 3.1 `page_name`

- `apply_entry`
- `apply_resume`
- `apply_result`
- `apply_materials`

### 3.2 `step_name`

- `invite_access`
- `intro`
- `resume_upload`
- `analysis_result`
- `supplemental`
- `secondary_analysis`
- `materials`
- `submit`

## 4. 事件字典

| event_type | 触发时机 | 来源 | 必填字段 | 落表 | 里程碑更新 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| `invite_link_opened` | 用户首次打开带 token 的邀约链接 | 前端 + 服务端入口路由 | `session_id`, `request_id`, `landing_path`, `token` | `InviteAccessLog` | 命中有效申请时更新 `first_accessed_at`、`last_accessed_at` | 记录 PV 主口径 |
| `session_restored` | 未带 token，但通过 cookie/session 恢复申请 | 服务端 | `session_id`, `request_id` | `InviteAccessLog` | 更新 `first_accessed_at`、`last_accessed_at` | 用于区分二次访问 |
| `invite_link_invalid` | token 无法匹配任何邀约 | 服务端 | `session_id`, `request_id`, `landing_path`, `token` | `InviteAccessLog` | 不更新 `Application` | 计算无效链接率 |
| `invite_link_expired` | token 匹配邀约但已过期 | 服务端 | `session_id`, `request_id`, `landing_path`, `token` | `InviteAccessLog` | 不更新 `Application` | 计算过期率 |
| `invite_link_disabled` | token 匹配邀约但被禁用 | 服务端 | `session_id`, `request_id`, `landing_path`, `token` | `InviteAccessLog` | 不更新 `Application` | 计算禁用率 |
| `intro_page_viewed` | 介绍页展示完成 | 前端 | `session_id`, `request_id`, `application_id`, `page_name`, `step_name` | `ApplicationEventLog` | 更新 `last_accessed_at` | 漏斗起点之一 |
| `start_apply_clicked` | 用户点击开始申请/继续申请 | 前端 | `session_id`, `request_id`, `application_id`, `page_name`, `step_name`, `action_name` | `ApplicationEventLog` | 更新 `intro_confirmed_at`、`last_accessed_at` | 可作为 intro 转化口径 |
| `resume_page_viewed` | 简历上传页展示 | 前端 | `session_id`, `request_id`, `application_id`, `page_name`, `step_name` | `ApplicationEventLog` | 更新 `last_accessed_at` | 便于看 intro 到 resume 的到达率 |
| `resume_upload_intent_created` | 成功创建简历上传 intent | 服务端 | `session_id`, `request_id`, `application_id`, `page_name`, `step_name` | `ApplicationEventLog` + `FileUploadAttempt` | 若为空则更新 `resume_upload_started_at`、`last_accessed_at` | 上传尝试开始主口径 |
| `resume_upload_started` | 浏览器开始向 OSS `PUT` 简历 | 前端 | `session_id`, `request_id`, `application_id`, `upload.file_name` | `ApplicationEventLog` + `FileUploadAttempt` | 更新 `last_accessed_at` | 反映真实上传启动 |
| `resume_upload_confirmed` | 服务端确认简历上传成功 | 服务端 | `session_id`, `request_id`, `application_id`, `event_status` | `ApplicationEventLog` + `FileUploadAttempt` | 更新 `resume_uploaded_at`、`last_accessed_at` | 上传成功主口径 |
| `resume_upload_failed` | intent / put / confirm 任一阶段失败 | 前端或服务端 | `session_id`, `request_id`, `application_id`, `event_status`, `error_code`, `upload.failure_stage` | `ApplicationEventLog` + `FileUploadAttempt` | 更新 `last_accessed_at` | 失败率与失败阶段分析 |
| `analysis_started` | 简历分析任务创建成功 | 服务端 | `session_id`, `request_id`, `application_id` | `ApplicationEventLog` | 更新 `analysis_started_at`、`last_accessed_at` | 和上传成功区分开 |
| `analysis_result_viewed` | 结果页首次或每次展示 | 前端 | `session_id`, `request_id`, `application_id`, `page_name`, `step_name` | `ApplicationEventLog` | 更新 `last_accessed_at`，首次完成时可补 `analysis_completed_at` | 建议首次查看和总查看都可统计 |
| `supplemental_submitted` | 用户提交补充字段成功 | 服务端 | `session_id`, `request_id`, `application_id`, `event_status` | `ApplicationEventLog` | 更新 `last_accessed_at` | 进入二次分析前关键节点 |
| `secondary_analysis_triggered` | 二次分析任务成功触发 | 服务端 | `session_id`, `request_id`, `application_id` | `ApplicationEventLog` | 更新 `last_accessed_at` | 统计补填后继续率 |
| `materials_page_viewed` | 材料页展示 | 前端 | `session_id`, `request_id`, `application_id`, `page_name`, `step_name` | `ApplicationEventLog` | 首次更新 `materials_entered_at`，并更新 `last_accessed_at` | 材料阶段入口口径 |
| `material_upload_intent_created` | 成功创建材料上传 intent | 服务端 | `session_id`, `request_id`, `application_id`, `upload.category` | `ApplicationEventLog` + `FileUploadAttempt` | 更新 `last_accessed_at` | 可分材料类别统计 |
| `material_upload_started` | 浏览器开始向 OSS `PUT` 材料 | 前端 | `session_id`, `request_id`, `application_id`, `upload.kind`, `upload.category` | `ApplicationEventLog` + `FileUploadAttempt` | 更新 `last_accessed_at` | 统计材料上传尝试 |
| `material_upload_confirmed` | 服务端确认材料上传成功 | 服务端 | `session_id`, `request_id`, `application_id`, `upload.category` | `ApplicationEventLog` + `FileUploadAttempt` | 更新 `last_accessed_at` | 材料成功数主口径 |
| `material_upload_failed` | 材料上传任一阶段失败 | 前端或服务端 | `session_id`, `request_id`, `application_id`, `error_code`, `upload.failure_stage` | `ApplicationEventLog` + `FileUploadAttempt` | 更新 `last_accessed_at` | 分类看失败率 |
| `submit_clicked` | 用户点击提交申请按钮 | 前端 | `session_id`, `request_id`, `application_id`, `page_name`, `step_name`, `action_name` | `ApplicationEventLog` | 更新 `last_accessed_at` | 作为提交意愿口径 |
| `application_submitted` | 提交接口完成且申请状态变为 `SUBMITTED` | 服务端 | `session_id`, `request_id`, `application_id`, `event_status` | `ApplicationEventLog` | 更新 `submitted_at`、`last_accessed_at` | 最终提交成功主口径 |
| `application_submit_failed` | 提交接口失败 | 服务端 | `session_id`, `request_id`, `application_id`, `event_status`, `error_code` | `ApplicationEventLog` | 更新 `last_accessed_at` | 建议补充，用于区分点击和成功 |

## 5. 上传事件字段补充口径

- `upload.kind`
  - `resume` 或 `material`
- `upload.category`
  - 仅材料上传时必填，值来自 `MaterialCategory`
- `upload.file_name`
  - 原始文件名
- `upload.file_ext`
  - 不带点后缀，小写
- `upload.file_size`
  - 字节数
- `upload.failure_stage`
  - `intent`、`put`、`confirm`
- `upload.object_key`
  - 拿到时再写，不要求所有阶段都有

## 6. 状态与错误口径

### 6.1 `event_status`

- 成功类事件统一写 `SUCCESS`
- 失败类事件统一写 `FAIL`

### 6.2 `error_code`

首版推荐统一词表：

- `token_invalid`
- `token_expired`
- `token_disabled`
- `session_invalid`
- `upload_intent_failed`
- `oss_put_failed`
- `oss_put_timeout`
- `upload_confirm_failed`
- `analysis_trigger_failed`
- `submit_failed`

### 6.3 `error_message`

- 可记录更具体原因，但不作为报表主维度

## 7. 去重与统计主口径

- PV 主口径
  - `invite_link_opened` 事件数
- UV 主口径
  - `invite_link_opened` 按 `session_id` 去重
- 无效链接率
  - `invite_link_invalid / invite_link_opened`
- 简历上传成功率
  - `resume_upload_confirmed / resume_upload_intent_created`
- 简历上传真实成功率
  - `resume_upload_confirmed / resume_upload_started`
- 最终提交转化率
  - `application_submitted / intro_page_viewed`
- 材料页到提交转化率
  - `application_submitted / materials_page_viewed`

## 8. 首版建议补充

- 建议把 `analysis_started` 和 `application_submit_failed` 也纳入首版，它们对阶段耗时和失败分析很关键
- 建议页面曝光只在首屏稳定渲染后上报一次，避免 React 重渲染造成重复 PV
- 建议前端按钮点击事件在真正执行动作前上报，服务端成功事件在动作完成后上报，这样能区分“意愿”和“结果”
