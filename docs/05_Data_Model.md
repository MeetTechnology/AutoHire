# 05 Data Model

## 1. `expert_invitation`

用途：邀约记录与 token 绑定

字段建议：

- `id`
- `expert_id`
- `email`
- `token`
- `token_status`
- `expired_at`
- `created_at`

## 2. `application`

用途：申请主记录

字段建议：

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

## 3. `resume_file`

用途：简历文件记录

字段建议：

- `id`
- `application_id`
- `file_name`
- `file_url`
- `file_type`
- `file_size`
- `version_no`
- `uploaded_at`

## 4. `resume_analysis_job`

用途：分析任务记录

字段建议：

- `id`
- `application_id`
- `job_type`
- `job_status`
- `stage_text`
- `error_message`
- `started_at`
- `finished_at`

## 5. `resume_analysis_result`

用途：结构化分析结果

字段建议：

- `id`
- `application_id`
- `analysis_job_id`
- `analysis_round`
- `eligibility_result`
- `reason_text`
- `display_summary`
- `extracted_fields_json`
- `missing_fields_json`
- `created_at`

## 6. `supplemental_field_submission`

用途：补充字段提交记录

字段建议：

- `id`
- `application_id`
- `analysis_job_id`
- `field_values_json`
- `submitted_at`

## 7. `application_material`

用途：证明材料记录

字段建议：

- `id`
- `application_id`
- `category`
- `file_name`
- `file_url`
- `file_type`
- `file_size`
- `uploaded_at`
- `is_deleted`

## 8. `application_event_log`

用途：关键事件审计日志

字段建议：

- `id`
- `application_id`
- `event_type`
- `event_payload_json`
- `created_at`

## 9. 关系说明

- 一个 `expert_invitation` 对应一个专家邀约
- 一个专家通常对应一个进行中的 `application`
- 一个 `application` 可有多次 `resume_analysis_job`
- 一个 `application` 可有多条 `resume_analysis_result`
- 一个 `application` 可有多条 `application_material`
