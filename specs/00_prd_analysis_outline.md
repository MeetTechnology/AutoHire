# PRD Analysis Outline

## 项目背景与目标

- 当前 `ApplicationEventLog` 只能记录已绑定 `applicationId` 的粗粒度事件，无法覆盖无效/过期 token 访问、上传失败链路、页面/按钮级漏斗，也无法稳定支持 UV/PV、无效链接率、阶段转化率、阶段耗时和 IP 监控。
- 本次目标是补齐“邀约访问日志 + 页面/动作事件日志 + 上传尝试日志 + 申请里程碑时间”四层观测基础，形成可直接用于运营、风控、漏斗和排障的数据底座。

## 目标用户

- 运营/增长：看链接点击、UV/PV、UTM 来源、无效链接率
- 风控/安全：看 IP 聚合、异常访问、失效 token 访问
- 产品/数据：看页面漏斗、按钮点击、阶段转化率、阶段耗时
- 工程/客服：看上传失败阶段、错误码、请求链路、会话恢复问题

## 核心业务流

- 邀约链接被打开
- token 校验或 session 恢复
- 页面访问与关键按钮点击
- 简历上传 intent / put / confirm / fail
- 分析结果查看、补填提交、二次分析触发
- 材料页访问、材料上传、最终提交

## MVP 功能需求

- 新增 `invite_access_log` 或 `traffic_event_log`
  - 支持记录无效/过期/禁用 token 访问
  - 支持 `session_restore`
  - 支持 `ip_hash`、`user_agent`、`referer`、`landing_path`、`session_id`、`request_id`、`utm_*`
- 扩展 `ApplicationEventLog`
  - 至少补 `event_time`, `page_name`, `step_name`, `action_name`, `event_status`, `error_code`, `error_message`, `duration_ms`, `session_id`, `request_id`, `ip_hash`, `user_agent`, `referer`
  - 保留 `eventPayload` 作为扩展字段，避免完全刚性化
- 扩展 `Application`
  - 增加关键里程碑时间字段，支持阶段耗时与转化直接计算
- 新增 `file_upload_attempt`
  - 覆盖 `intent`、`put`、`confirm`、`fail`
  - 区分 `resume/material`
  - 支持失败阶段和失败码分析
- 统一关键漏斗事件字典
  - `invite_link_opened`
  - `intro_page_viewed`
  - `start_apply_clicked`
  - `resume_upload_intent_created`
  - `resume_upload_confirmed`
  - `resume_upload_failed`
  - `analysis_result_viewed`
  - `supplemental_submitted`
  - `secondary_analysis_triggered`
  - `materials_page_viewed`
  - `material_upload_confirmed`
  - `submit_clicked`
  - `application_submitted`

## 后续迭代

- 增加聚合宽表/日报任务
- 增加风控阈值与告警
- 增加会话级路径还原
- 增加下载/预览/删除等更细事件
- 增加后台报表 API 或 BI 对接

## 非功能需求

- 事件写入不能显著阻塞主链路
- 日志字段命名和枚举口径稳定
- 支持按 `invitationId`、`applicationId`、`sessionId`、`requestId`、时间范围查询
- `ip` 只存 hash，不存明文
- 应允许部分上下文字段为空，尤其是无效 token 场景

## 风险与开放问题

- `invite_access_log` 和强化后的 `ApplicationEventLog` 职责可能重叠，若边界不清后续会产生双写混乱
- `Application` 里程碑时间字段既可能来自事件推导，也可能来自业务状态变更直接写入，需要确定谁是真源
- 页面/按钮事件是否只记录服务端可确认事件，还是也接收前端埋点，会影响准确性和实现复杂度
- 上传 `put` 阶段是否能可靠拿到开始/失败时间，取决于前端与 OSS 交互埋点方式

## 推荐结论

- `invite_access_log` 单独建表，不要硬塞进 `ApplicationEventLog`
- `ApplicationEventLog` 保留为“已识别到 application 的业务事件流”
- `Application` 里程碑时间继续保留为便于查询的派生真源
- `file_upload_attempt` 单独建表，因为它本质上是漏斗与故障分析表，不只是事件流
