# Implementation Plan And Integration Sequence

## 1. 实施原则

- 先建数据底座，再接服务端强事实，最后接前端页面/按钮事件
- 先保证“可落库、可查询、不中断主流程”，再做报表和口径优化
- 所有改造按“兼容旧逻辑、渐进启用、灰度验证”推进

## 2. Phase 1: 数据库迁移

目标：先把表和字段准备好，但不要求第一天全部写满。

1. 新增枚举
   - `AccessResult`
   - `AccessTokenStatusSnapshot`
   - `EventStatus`
   - `UploadKind`
   - `UploadFailureStage`
2. 新建表
   - `InviteAccessLog`
   - `FileUploadAttempt`
3. 扩展表
   - `ApplicationEventLog` 增加查询字段
   - `Application` 增加里程碑时间字段
4. 新增索引
   - 时间索引
   - `applicationId/sessionId/requestId/eventType/failureStage` 索引
   - `utm` 和 `accessResult` 相关索引
5. 迁移策略
   - 新字段先允许空值
   - 不立即加严格非空约束
   - 先确保迁移可在现有生产数据上安全执行

## 3. Phase 2: 后端埋点基础设施

目标：先把服务端统一写事件的能力建出来。

1. 新增统一埋点服务
   - 例如 `src/lib/tracking/service.ts`
   - 负责：
     - 规范化事件
     - 路由到不同表
     - 更新 `Application` 里程碑
     - 写入 `ApplicationEventLog`
     - 写入 `InviteAccessLog`
     - 写入 `FileUploadAttempt`
2. 新增公共上下文提取
   - 提取 `session_id`
   - 提取 `request_id`
   - 提取 `referer`
   - 服务端计算 `ip_hash`
   - 解析 `utm_*`
   - 解析 `token -> invitation/application` 归属
3. 新增 `POST /api/track`
   - 校验 payload
   - 统一调用 tracking service
   - 保证失败不阻塞主流程
   - 返回 `accepted` 与绑定上下文
4. 扩展内存模式
   - 同步更新 `src/lib/data/store.ts`
   - 避免 `memory` 与 Prisma 模式行为不一致

## 4. Phase 3: 服务端关键事件接入

目标：先接“强事实事件”，优先保证转化和里程碑口径。

1. 邀约与会话
   - `/api/expert-session`
   - 写：
     - `invite_link_opened`
     - `session_restored`
     - `invite_link_invalid`
     - `invite_link_expired`
     - `invite_link_disabled`
2. 简历上传
   - `resume upload intent`
   - `resume confirm`
   - 写：
     - `resume_upload_intent_created`
     - `resume_upload_confirmed`
     - 服务端失败时写 `resume_upload_failed`
3. 分析流程
   - 分析任务创建成功时写 `analysis_started`
   - 分析结果落库成功时更新 `analysis_completed_at`
4. 补填与二次分析
   - `supplemental_submitted`
   - `secondary_analysis_triggered`
5. 材料上传
   - `material_upload_intent_created`
   - `material_upload_confirmed`
   - 服务端失败时写 `material_upload_failed`
6. 最终提交
   - `application_submitted`
   - `application_submit_failed`

## 5. Phase 4: 前端埋点 SDK/Client 接入

目标：补齐页面曝光、按钮点击、OSS `PUT` 行为。

1. 新增前端埋点客户端
   - 例如 `src/lib/tracking/client.ts`
   - 能力：
     - 生成/复用 `session_id`
     - 每次上报生成 `request_id`
     - 调用 `POST /api/track`
     - 自动带上 `page_name/step_name/referer/landing_path`
2. 页面曝光接入
   - `/apply` -> `intro_page_viewed`
   - `/apply/resume` -> `resume_page_viewed`
   - `/apply/result` -> `analysis_result_viewed`
   - `/apply/materials` -> `materials_page_viewed`
3. 按钮点击接入
   - `start_apply_clicked`
   - `submit_clicked`
4. OSS 上传阶段接入
   - `resume_upload_started`
   - `resume_upload_failed`
   - `material_upload_started`
   - `material_upload_failed`
5. 防重策略
   - 页面曝光只在稳定首屏后触发一次
   - 按钮点击防双击重复上报
   - 上传开始/失败按单次上传实例上报

## 6. Phase 5: 回填与历史兼容

目标：补最关键、最可靠的数据，不制造伪精确。

1. 可回填
   - `ApplicationEventLog.eventTime = createdAt`
   - `Application.lastAccessedAt = 最近一次可靠业务事件时间`
   - 保留已有 `submittedAt`
2. 不强行回填
   - `firstAccessedAt`
   - `introConfirmedAt`
   - `resumeUploadStartedAt`
   - `analysisStartedAt`
   - `materialsEnteredAt`
3. seed 补充
   - 有效 invite 访问样例
   - 无效/过期/禁用 invite 样例
   - 上传成功/失败样例
   - 提交成功/失败样例

## 7. Phase 6: 报表与查询验证

目标：上线前确认指标能算得出来。

1. 验证入口指标
   - invite PV/UV
   - invalid/expired/disabled rate
2. 验证漏斗指标
   - intro -> resume -> result -> materials -> submitted
3. 验证上传指标
   - intent/start/success/fail
   - fail by stage
4. 验证耗时指标
   - intro -> resume upload
   - resume upload -> analysis complete
   - materials enter -> submit

## 8. 验收步骤

1. 执行 migration，确认库结构更新成功。
2. 运行 seed，确认新表可写入样例数据。
3. 用有效 token 走完整主流程，检查 4 张核心表是否都写入。
4. 用无效/过期/禁用 token 访问，确认 `InviteAccessLog` 有记录。
5. 模拟 OSS 上传失败，确认 `FileUploadAttempt.failureStage` 正确。
6. 提交成功后，确认 `Application.submittedAt` 和事件流一致。
7. 抽样核对 `session_id/request_id/application_id` 串联关系。

## 9. 上线顺序建议

1. 先发数据库迁移
2. 再发后端 tracking service 和 `POST /api/track`
3. 再发服务端关键事件双写
4. 再发前端页面/按钮/上传埋点
5. 最后开放报表查询与运营使用

## 10. 风险控制

- 埋点失败不得影响主流程返回
- 首版不开严格非空约束，降低发布风险
- 前端事件允许少量丢失，但服务端强事实必须稳定写入
- 上线后先观察 3 到 7 天，再决定是否收紧字段约束和补更多索引

## 11. 交付物

- Prisma schema 和 migration
- tracking service
- `POST /api/track`
- 前端 tracking client
- 核心流程埋点接入
- seed 样例
- 基础 SQL/报表查询脚本
- 验收清单
