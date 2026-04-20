# Reporting Metrics And Calculations

## 1. 目标

- 给运营、产品、风控、工程提供统一且可落地的首版指标口径
- 明确每个指标基于哪张表、哪个事件、如何去重、如何分母分子定义
- 避免同一指标因“页面事件”和“服务端事件”混用而出现多套口径

## 2. 口径总原则

- 访问类指标优先基于 `InviteAccessLog`
- 流程漏斗类指标优先基于 `ApplicationEventLog`
- 上传成功/失败类指标优先基于 `FileUploadAttempt`
- 阶段耗时类指标优先基于 `Application` 里程碑时间
- 若同类指标有“行为口径”和“结果口径”，报表中必须明确标注
- 默认统计时间以事件发生时间为准：
  - `InviteAccessLog.occurredAt`
  - `ApplicationEventLog.eventTime`
  - `FileUploadAttempt.createdAt`
  - `Application` 里程碑字段本身时间

## 3. 访问与渠道指标

- `invite_pv`
  - 定义：邀约链接打开总次数
  - 数据源：`InviteAccessLog`
  - 口径：`accessResult = VALID` 的 `invite_link_opened` 记录数
- `invite_uv`
  - 定义：邀约链接独立访问会话数
  - 数据源：`InviteAccessLog`
  - 口径：`accessResult = VALID` 的 `session_id` 去重数
- `invalid_link_pv`
  - 定义：无效 token 访问次数
  - 数据源：`InviteAccessLog`
  - 口径：`accessResult = INVALID`
- `expired_link_pv`
  - 定义：过期 token 访问次数
  - 数据源：`InviteAccessLog`
  - 口径：`accessResult = EXPIRED`
- `disabled_link_pv`
  - 定义：禁用 token 访问次数
  - 数据源：`InviteAccessLog`
  - 口径：`accessResult = DISABLED`
- `invalid_link_rate`
  - 定义：无效链接访问占全部 invite 打开尝试的比例
  - 分子：`accessResult = INVALID`
  - 分母：`accessResult in (VALID, INVALID, EXPIRED, DISABLED)`
- `expired_link_rate`
  - 分子：`accessResult = EXPIRED`
  - 分母：`accessResult in (VALID, INVALID, EXPIRED, DISABLED)`
- `disabled_link_rate`
  - 分子：`accessResult = DISABLED`
  - 分母：`accessResult in (VALID, INVALID, EXPIRED, DISABLED)`
- `session_restore_rate`
  - 定义：通过 cookie/session 恢复进入流程的比例
  - 分子：`accessResult = SESSION_RESTORE`
  - 分母：有效进入流程的访问数
- `channel_uv`
  - 定义：按 `utm_source / utm_medium / utm_campaign` 维度统计 UV
  - 数据源：`InviteAccessLog`
  - 口径：有效 invite 打开按 `session_id` 去重

## 4. 流程漏斗指标

默认使用“申请维度漏斗”，即分子分母都按 `application_id` 去重。

- `intro_view_applications`
  - `eventType = intro_page_viewed`，按 `applicationId` 去重
- `start_apply_applications`
  - `eventType = start_apply_clicked`
- `resume_page_view_applications`
  - `eventType = resume_page_viewed`
- `resume_upload_started_applications`
  - 数据源优先 `FileUploadAttempt`
  - 口径：`uploadStartedAt is not null`，按 `applicationId` 去重
- `resume_upload_success_applications`
  - 数据源优先 `FileUploadAttempt`
  - 口径：`uploadConfirmedAt is not null and kind = RESUME`
- `analysis_result_view_applications`
  - `eventType = analysis_result_viewed`
- `supplemental_submit_applications`
  - `eventType = supplemental_submitted`
- `materials_page_view_applications`
  - `eventType = materials_page_viewed`
- `submit_click_applications`
  - `eventType = submit_clicked`
- `submitted_applications`
  - 数据源：`Application`
  - 口径：`submittedAt is not null`

## 5. 漏斗转化率定义

- `intro_to_start_rate`
  - `start_apply_applications / intro_view_applications`
- `start_to_resume_page_rate`
  - `resume_page_view_applications / start_apply_applications`
- `resume_page_to_upload_start_rate`
  - `resume_upload_started_applications / resume_page_view_applications`
- `upload_start_to_upload_success_rate`
  - `resume_upload_success_applications / resume_upload_started_applications`
- `upload_success_to_result_view_rate`
  - `analysis_result_view_applications / resume_upload_success_applications`
- `result_to_materials_rate`
  - `materials_page_view_applications / analysis_result_view_applications`
- `materials_to_submit_click_rate`
  - `submit_click_applications / materials_page_view_applications`
- `submit_click_to_submit_success_rate`
  - `submitted_applications / submit_click_applications`
- `end_to_end_submit_rate`
  - `submitted_applications / intro_view_applications`

## 6. 上传质量指标

- `resume_upload_intent_count`
  - `kind = RESUME and intentCreatedAt is not null`
- `resume_upload_start_count`
  - `kind = RESUME and uploadStartedAt is not null`
- `resume_upload_success_count`
  - `kind = RESUME and uploadConfirmedAt is not null`
- `resume_upload_fail_count`
  - `kind = RESUME and uploadFailedAt is not null`
- `resume_intent_to_success_rate`
  - `resume_upload_success_count / resume_upload_intent_count`
- `resume_start_to_success_rate`
  - `resume_upload_success_count / resume_upload_start_count`
- `resume_fail_by_stage`
  - 维度：`failureStage`
- `material_upload_success_rate`
  - 口径：`kind = MATERIAL`
  - 可按 `category` 分组统计
- `avg_upload_duration_ms`
  - 数据源：`FileUploadAttempt`
  - 口径：成功记录优先，`durationMs` 平均值

## 7. 阶段耗时指标

阶段耗时统一优先基于 `Application` 里程碑字段计算。

- `time_intro_to_resume_upload`
  - `resumeUploadedAt - introConfirmedAt`
- `time_resume_upload_to_analysis_complete`
  - `analysisCompletedAt - resumeUploadedAt`
- `time_analysis_complete_to_materials_enter`
  - `materialsEnteredAt - analysisCompletedAt`
- `time_materials_enter_to_submit`
  - `submittedAt - materialsEnteredAt`
- `time_first_access_to_submit`
  - `submittedAt - firstAccessedAt`
- `time_first_access_to_last_access`
  - `lastAccessedAt - firstAccessedAt`

展示方式建议：

- 平均值 `avg`
- 中位数 `p50`
- `p90`
- 样本数 `n`

首版至少建议输出：

- `avg`
- `p50`
- 样本数

## 8. 风控与异常访问指标

- `ip_uv`
  - 定义：按 `ip_hash` 去重的访问量
  - 数据源：`InviteAccessLog`
- `high_frequency_ip_count`
  - 定义：单日访问次数超过阈值的 `ip_hash` 数量
  - 阈值首版建议可配置，例如 `> 20`
- `multi_session_same_ip_count`
  - 定义：同一 `ip_hash` 关联多个 `session_id` 的数量
- `invalid_access_by_ip`
  - 定义：按 `ip_hash` 统计 `INVALID / EXPIRED / DISABLED` 次数

## 9. 维度切片建议

首版报表建议至少支持这些维度：

- 时间：按日、周
- 渠道：`utm_source`, `utm_medium`, `utm_campaign`
- 结果：`accessResult`, `eventType`, `failureStage`
- 业务状态：`applicationStatus`
- 上传类型：`kind`
- 材料类别：`category`

## 10. 口径优先级

当多个来源都能算同一指标时，采用以下优先顺序：

- 提交成功
  - `Application.submittedAt`
  - 其次才是 `application_submitted` 事件
- 上传成功/失败
  - `FileUploadAttempt`
  - 其次才是 `ApplicationEventLog`
- 阶段耗时
  - `Application` 里程碑字段
  - 不直接在线查询事件流拼接
- 入口访问
  - `InviteAccessLog`
  - 不使用 `ApplicationEventLog` 替代

## 11. 首版报表面板建议

- 入口与渠道
  - invite PV
  - invite UV
  - invalid/expired/disabled rate
  - channel UV
- 核心漏斗
  - intro viewed
  - start apply
  - resume upload success
  - result viewed
  - materials viewed
  - submitted
- 上传质量
  - resume intent/start/success/fail
  - material success/fail
  - fail by stage
  - avg upload duration
- 阶段耗时
  - first access -> submit
  - intro confirm -> resume upload
  - resume upload -> analysis complete
  - materials enter -> submit
- 风控观察
  - invalid access by day
  - top IP hash by invalid access
  - high frequency IP count

## 12. 注意事项

- UV 默认按 `session_id` 去重，不按 `ip_hash` 去重
- 申请转化默认按 `application_id` 去重，不按事件次数计算
- 页面 PV 可保留事件次数，但不要和申请漏斗混算
- `submitted_applications` 必须以申请主表为真源，否则会受重复事件影响
- 所有比例指标都要同时展示分子、分母和样本量，避免误判
