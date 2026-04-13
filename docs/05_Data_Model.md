# 05 Data Model

## 当前状态（2026-04-11）

- 当前 Prisma / PostgreSQL 主模型已覆盖专家端 MVP 主流程
- 当前已完成本轮 schema hardening：
  - `application.invitation_id` 唯一化，确保一个邀约只恢复同一条申请
  - `resume_analysis_result.analysis_job_id` 增加唯一约束与外键
  - `supplemental_field_submission.analysis_job_id` 增加外键
  - `resume_analysis_job.resume_file_id` 绑定触发分析的简历版本
  - `resume_file(application_id, version_no)` 增加联合唯一约束
  - `application_material.deleted_at` 补齐软删除时间戳

## 1. `expert_invitation`

用途：邀约记录与 token 绑定。

核心字段：

- `id`
- `expert_id`
- `email`
- `token_hash`
- `token_status`
- `expired_at`
- `created_at`
- `updated_at`

关键约束：

- `token_hash` 唯一
- 建议仅保存 token 摘要，不保存明文 token

## 2. `application`

用途：申请主记录，是状态机与页面恢复的核心真源。

核心字段：

- `id`
- `expert_id`
- `invitation_id`
- `application_status`
- `current_step`
- `eligibility_result`
- `latest_analysis_job_id`
- `submitted_at`
- `created_at`
- `updated_at`

关键约束：

- `invitation_id` 唯一，确保一个邀约只对应一条申请主记录
- `invitation_id` 外键关联 `expert_invitation.id`

说明：

- `application_status` 是页面跳转和权限控制的唯一业务真源
- `latest_analysis_job_id` 当前作为应用层快速定位字段保留
- 当前资格通过后会继续经历：
  - `SECONDARY_ANALYZING`
  - `SECONDARY_REVIEW`
  - `SECONDARY_FAILED`
  再进入 `MATERIALS_IN_PROGRESS`

## 3. `resume_file`

用途：简历文件记录，只保存受控访问所需元数据，不暴露底层直链。

核心字段：

- `id`
- `application_id`
- `file_name`
- `object_key`
- `file_type`
- `file_size`
- `version_no`
- `uploaded_at`

关键约束：

- `application_id` 外键关联 `application.id`
- `application_id + version_no` 联合唯一，确保同一申请的简历版本号不重复

## 4. `resume_analysis_job`

用途：异步简历分析任务记录，承接首次分析与补填后二次分析。

核心字段：

- `id`
- `application_id`
- `resume_file_id`
- `external_job_id`
- `job_type`
- `job_status`
- `stage_text`
- `error_message`
- `started_at`
- `finished_at`

关键约束：

- `application_id` 外键关联 `application.id`
- `resume_file_id` 外键关联 `resume_file.id`
- `external_job_id` 唯一

说明：

- `resume_file_id` 用于追踪“哪一版简历触发了这次分析”
- `job_type` 当前取值为 `INITIAL` / `REANALYSIS`

## 5. `resume_analysis_result`

用途：结构化分析结果，承接适配层标准输出。

核心字段：

- `id`
- `application_id`
- `analysis_job_id`
- `analysis_round`
- `eligibility_result`
- `reason_text`
- `display_summary`
- `extracted_fields`
- `missing_fields`
- `created_at`

关键约束：

- `application_id` 外键关联 `application.id`
- `analysis_job_id` 外键关联 `resume_analysis_job.id`
- `analysis_job_id` 唯一，确保一个分析任务只落一条最终结果

说明：

- `missing_fields` 保存动态表单配置
- `extracted_fields` 保存结构化提取结果快照
- 当前 `extracted_fields` 中可附带内部调试元数据（如 `__rawReasoning`），前端摘要展示会忽略这些内部键

## 6. `supplemental_field_submission`

用途：补充字段提交记录，用于审计与二次分析输入追踪。

核心字段：

- `id`
- `application_id`
- `analysis_job_id`
- `field_values`
- `submitted_at`

关键约束：

- `application_id` 外键关联 `application.id`
- `analysis_job_id` 可空外键关联 `resume_analysis_job.id`

说明：

- `analysis_job_id` 指向提交时对应的最近一次分析任务，便于审计前后文
- `field_values` 当前保存为富结构 JSON，至少包括：
  - `valuesByFieldKey`
  - `valuesBySourceItemName`
  - `fieldMeta`
  - `missingFieldsSnapshot`

## 7. `application_material`

用途：证明材料记录，按 6 个分类持久化上传元数据。

核心字段：

- `id`
- `application_id`
- `category`
- `file_name`
- `object_key`
- `file_type`
- `file_size`
- `uploaded_at`
- `is_deleted`
- `deleted_at`

关键约束：

- `application_id` 外键关联 `application.id`
- 材料列表查询应以 `is_deleted = false` 为准

说明：

- 当前采用业务层软删除
- `deleted_at` 用于补齐删除审计时间点

## 8. `secondary_analysis_run`

用途：记录二次分析运行元数据，并持久化上游原始结果，作为专家可编辑字段的审计真源。

核心字段：

- `id`
- `application_id`
- `analysis_job_id`
- `external_run_id`
- `status`
- `error_message`
- `run_summary`
- `raw_results`
- `created_at`
- `updated_at`

关键约束：

- `application_id` 外键关联 `application.id`
- `analysis_job_id` 可空外键关联 `resume_analysis_job.id`
- `application_id + external_run_id` 联合唯一

说明：

- 一个申请当前只允许一条二次分析运行记录
- `raw_results` 保存上游 `secondary_results[].generated_text` 原文，不受专家编辑影响
- `run_summary` 保存上游 secondary run 状态摘要，用于页面恢复和轮询

## 9. `secondary_analysis_field_value`

用途：保存专家端二次分析字段的模型原值、人工覆盖值和最终生效值。

核心字段：

- `id`
- `application_id`
- `secondary_run_id`
- `no`
- `column_name`
- `label`
- `source_value`
- `edited_value`
- `effective_value`
- `has_override`
- `is_missing`
- `is_edited`
- `saved_at`
- `created_at`
- `updated_at`

关键约束：

- `application_id` 外键关联 `application.id`
- `secondary_run_id` 外键关联 `secondary_analysis_run.id`
- `secondary_run_id + no` 联合唯一

说明：

- `effective_value` 计算规则为：
  - `has_override=true` 时取 `edited_value`
  - 否则取 `source_value`
- 这样专家可以明确把字段保存为空，而不会自动回退到模型值
- `is_missing` 基于 `effective_value` 计算
- `is_edited` 用于标记人工覆盖是否实际改变了模型值

## 10. `application_event_log`

用途：关键事件审计日志。

核心字段：

- `id`
- `application_id`
- `event_type`
- `event_payload`
- `created_at`

关键约束：

- `application_id` 外键关联 `application.id`

建议记录事件：

- 链接访问
- 申请创建
- 简历上传
- 分析开始
- 分析完成
- 信息补填提交
- 材料上传
- 材料删除
- 最终提交
- 错误与重试

## 11. 关系说明

- 一个 `expert_invitation` 对应一个专家邀约
- 一个 `expert_invitation` 对应一条 `application`
- 一个 `application` 可有多个 `resume_file`
- 一个 `application` 可有多个 `resume_analysis_job`
- 一个 `resume_analysis_job` 绑定零到一个 `resume_file`
- 一个 `resume_analysis_job` 对应零到一个 `resume_analysis_result`
- 一个 `application` 可有多条 `supplemental_field_submission`
- 一个 `application` 可有零到一条 `secondary_analysis_run`
- 一个 `secondary_analysis_run` 可有多条 `secondary_analysis_field_value`
- 一个 `application` 可有多条 `application_material`
- 一个 `application` 可有多条 `application_event_log`

## 12. Schema 优化清单

### 必须补

- 一个邀约只能恢复同一条申请：
  已实施，`application.invitation_id` 已唯一化
- 分析任务与结果必须一一对应：
  已实施，`resume_analysis_result.analysis_job_id` 已加唯一约束和外键
- 补充字段提交应能追溯到触发分析上下文：
  已实施，`supplemental_field_submission.analysis_job_id` 已加外键

### 建议补

- 分析任务应绑定具体简历版本：
  已实施，`resume_analysis_job.resume_file_id` 已落库
- 简历版本号应避免重复：
  已实施，`resume_file(application_id, version_no)` 已加联合唯一约束
- 材料软删除应保留删除时间：
  已实施，`application_material.deleted_at` 已补齐

### 可暂缓

- 为 `application.latest_analysis_job_id` 增加更强的一致性约束
- 为 `application` 增加 `closed_at`、`close_reason`
- 增加文件访问审计表，用于受控下载 / 预览链路
- 根据 live 分析联调结果决定是否拆分 `missing_fields` 标准化表
