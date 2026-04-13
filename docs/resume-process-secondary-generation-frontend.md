# 简历处理模块：二次生成后的前端数据与展示说明

本文档说明 **简历处理（Resume Process）** 功能在 **二次生成** 完成后，前端从接口接收的字段、页面展示的信息，以及数据从请求到表格的读取与解析流程。实现代码主要位于 `frontend/src/app/(protected)/resume-process/[jobId]/page.tsx` 及相关 `lib`、`types`、`components`。

---

## 1. 功能入口与相关文件

| 说明 | 路径 |
|------|------|
| 任务详情页（含二次生成 UI） | `frontend/src/app/(protected)/resume-process/[jobId]/page.tsx` |
| 任务详情与触发二次生成 API | `frontend/src/lib/resume-process.ts` |
| 二次生成正文解析（`NO.*###`） | `frontend/src/lib/resume-process-secondary-parser.ts` |
| NO 序号 → Excel 列字母、表头中文、重点列说明 | `frontend/src/lib/resume-process-secondary-mapping.ts` |
| 二次结果表格组件 | `frontend/src/components/features/resume-process/resume-process-secondary-parsed-table.tsx` |
| 重点列提示卡片 | `frontend/src/components/features/resume-process/resume-process-important-columns-notice.tsx` |
| TypeScript 类型定义 | `frontend/src/types/index.ts`（`ResumeProcess*` 段） |
| SSE 订阅（状态变更后刷新详情） | `frontend/src/hooks/use-resume-process-subscription.ts` |

---

## 2. 二次生成后前端「接收」的接口与数据结构

### 2.1 主接口：获取任务详情

- **方法 / 路径**：`GET /resume-process/jobs/{jobId}`
- **可选查询参数**：`run_id`（指定某次二次生成批次；触发二次生成后会用返回的 `run_id` 再拉取）
- **封装函数**：`fetchResumeProcessJob(jobId, runId?)`（`frontend/src/lib/resume-process.ts`）

响应类型为 `ResumeProcessJobDetailsResponse`，与二次生成直接相关的字段如下。

#### `job`（`ResumeProcessJob`）

| 字段（英文） | 含义（中文） | 二次生成相关用途 |
|--------------|--------------|------------------|
| `id` | 任务 ID | 展示「任务 ID」 |
| `status` | 初次分析主流程状态 | 与能否触发二次生成等逻辑相关 |
| `secondary_status` | 二次生成状态 | 展示「二次生成」状态徽标；控制「生成中 / 重试」等按钮文案 |
| `error_message` | 主流程错误信息 | 任务卡片内错误提示 |
| `secondary_error_message` | 二次生成错误信息 | 任务卡片内琥珀色提示 |
| `created_at` / `updated_at` | 创建 / 更新时间 | 任务信息展示 |

`secondary_status` 在前端类型中为：`idle` \| `pending` \| `processing` \| `retrying` \| `completed` \| `completed_partial` \| `failed`。

#### `secondary_run`（`ResumeProcessSecondaryRun | null`，可选）

| 字段（英文） | 含义（中文） | 页面用途 |
|--------------|--------------|----------|
| `id` | 当前批次 Run ID | 文案「当前批次 Run #…」；导出时可带 `run_id` |
| `status` | 该批次状态 | 判断是否「二次生成全部完成」 |
| `total_prompts` / `completed_prompts` | 总 prompt 数 / 已完成数 | 卡片描述「成功 x / y」 |
| `failed_prompt_ids` | 失败 prompt ID 列表 | 描述中展示失败 ID |
| 其余如 `retryable`、`error_message` 等 | 重试、错误等 | 类型中存在，详情页主要展示上述几项 |

#### `secondary_results`（`ResumeProcessSecondaryResult[]`）

这是 **二次生成结果正文** 的来源，前端会遍历该数组读取 `generated_text`。

| 字段（英文） | 含义（中文） | 用途 |
|--------------|--------------|------|
| `id` | 结果记录 ID | 列表项标识（表格不直接展示） |
| `job_id` | 所属任务 | 关联 |
| `secondary_run_id` | 所属二次批次 | 关联 |
| `prompt_id` | 对应 prompt | 关联 |
| `generated_text` | **模型生成的文本** | **拼接后按 `NO.n###` 规则解析为表格行** |
| `status` | `processing` / `completed` / `error` | 判断是否已有完成项（导出按钮等） |
| `error_message` | 单条错误信息 | 类型支持；详情页表格数据主要来自 `generated_text` |

> 说明：表格里的「字段中文名、列号、内容」**不是**后端逐字段 JSON，而是由 **`generated_text` 中的 `NO.{序号}###` 标记 + 前端静态映射表** 推导得出（见第 4 节）。

### 2.2 触发二次生成

- **方法 / 路径**：`POST /resume-process/jobs/{jobId}/trigger-secondary`
- **返回**：`{ message, job_id, run_id }`（`ResumeProcessTriggerSecondaryResponse`）
- 前端成功后会 `setCurrentRunId(run_id)` 并 `await load(run_id)`，保证后续详情与 `secondary_results` 对应该批次。

### 2.3 SSE（服务端推送）

- **路径**：通过 `NEXT_PUBLIC_API_BASE_URL` 拼出 `resume-process/subscribe/{jobId}`（见 `subscribeResumeProcessJob`）。
- **载荷类型**：`ResumeProcessJobUpdatePayload`（含 `job_status`、`secondary_status`、`stage`、`run_id` 等）。
- **前端行为**：收到消息后 **节流约 600ms** 再次调用 `fetchResumeProcessJob` **全量刷新**详情（含最新的 `secondary_results`），从而驱动「生成中 → 完成」的 UI。

---

## 3. 二次生成完成后页面「展示」哪些信息（除表格外）

详情页在「任务信息」「二次生成结果」卡片中展示的内容包括：

- **任务信息**：任务 ID、初次分析状态、二次生成状态、创建/更新时间、主流程/二次流程错误文案（若有）。
- **二次生成结果卡片标题区**：是否「已全部完成」标签；进行中时的加载提示；若有 `secondary_run` 则展示 **Run #id、成功数/总数、失败 prompt id 列表**；完成后的绿色提示条。
- **导出**：存在任意 `secondary_results` 项 `status === 'completed'` 时显示导出按钮（`ResumeProcessExportButton`，可带 `run_id`）。
- **重点列说明**：固定文案卡片（`ResumeProcessImportantColumnsNotice`），与下方表格「重点」列使用的规则一致（见第 5 节）。

表格为空且 `secondary_results` 长度为 0 时，展示：「暂无二次生成结果…」类提示。

---

## 4. 表格数据如何「读取」与解析

### 4.1 数据流概览

1. `fetchResumeProcessJob` 返回 `data.secondary_results`。
2. 取出每条结果的 `generated_text`，组成字符串数组：  
   `texts = secondary_results.map((r) => r.generated_text || '')`。
3. `parseSecondaryNOFieldsFromManyTexts(texts)`（`resume-process-secondary-parser.ts`）：
   - 对每段文本做 `normalizeResumeProcessText`（去外层引号、统一换行、把 `^^^` 换行等）；
   - 用 `\n` 拼接为多段合一的大文本；
   - 用正则 **`/NO\.(\d+)###/g`** 查找所有 `NO.{数字}###` 锚点；
   - 两个锚点之间的子串为对应 **序号 `no`** 的 **内容 `value`**（再做 `cleanSegmentValue`：去尾 `###`、空字符等）。
4. 仅保留 **`no` 在 1～41 之间** 的片段（与导出模板列一致）。
5. 对每个 `no` 查静态表：  
   - `column` ← `RESUME_PROCESS_SECONDARY_NO_TO_COLUMN[no]`（Excel 列字母，如 `K`、`AA`）  
   - `header` ← `RESUME_PROCESS_SECONDARY_NO_TO_HEADER[no]`（表头中文）  
   - 若无表头映射则退化为 `` `NO.${no}` ``。
6. **合并规则**：同一 `no` 出现多次时，优先保留有内容的；若两段内容不同则 **用双换行拼接**。

解析结果类型 `ResumeProcessFieldMapping`：

| 属性 | 含义 |
|------|------|
| `no` | 序号 1～41 |
| `column` | Excel 列（英文字母，如 `K`、`AB`） |
| `header` | 字段中文表头（来自映射表） |
| `value` | 该 NO 段解析出的正文 |

### 4.2 表格列（UI 表头中文）

`ResumeProcessSecondaryParsedTable` 列依次为：

| 列标题（页面） | 对应数据 |
|----------------|----------|
| NO | `NO.{no}` 展示 |
| 列 | `column`，无则 `-` |
| 重点 | 若 `column` 在「重点列」表中则显示徽章 + 说明文案，否则 `-` |
| 字数 | 去除空白后的字符数；超过 800 用红色徽章标「超长」 |
| 字段 | `header`（中文表头） |
| 内容 | `value`，`pre-wrap` 展示 |

另：超过 800 字的字段会在表格上方单独列出「超长提醒」卡片。

若整段文本中 **未匹配到任何 `NO.*###`**，表格区域显示：「未检测到 NO.*### 段落。」

---

## 5. 序号、Excel 列（英文）、表头（中文）对照表（1～41）

下列与 `frontend/src/lib/resume-process-secondary-mapping.ts` 中  
`RESUME_PROCESS_SECONDARY_NO_TO_COLUMN`、`RESUME_PROCESS_SECONDARY_NO_TO_HEADER` **保持一致**。

| 序号 NO | Excel 列（英文） | 表头（中文，含业务约定） |
|--------:|------------------|--------------------------|
| 1 | K | *姓名 |
| 2 | L | 性别 |
| 3 | M | *出生日期（无则1900-01-01） |
| 4 | N | 国籍/族群 |
| 5 | O | 出生国家 |
| 6 | P | *来源地/国 |
| 7 | Q | 华裔 |
| 8 | R | 证件类型 |
| 9 | S | *证件号（如无：无+客户号） |
| 10 | T | 证件过期日（无则1900-01-01） |
| 11 | U | 其他联系方式 |
| 12 | V | 个人邮箱（唯一） |
| 13 | W | 工作邮箱（唯一） |
| 14 | X | 手机号（唯一） |
| 15 | Y | 最高学位 |
| 16 | Z | 博士毕业时间 |
| 17 | AA | 博士毕业国家 |
| 18 | AB | 博士毕业院校中文 |
| 19 | AC | 博士毕业院校英文 |
| 20 | AD | 博士专业 |
| 21 | AE | 博士院校QS排名 |
| 22 | AF | 目前职称 |
| 23 | AG | 职称英文 |
| 24 | AH | 就职单位中文 |
| 25 | AI | 就职单位英文 |
| 26 | AJ | 最新工作QS排名 |
| 27 | AN | 代表性奖项头衔 |
| 28 | AL | 同业竞争信息 |
| 29 | AM | （省/国）入选信息 |
| 30 | AO | 备注 |
| 31 | AP | 邮件岗视频和微信或邮件重要沟通记录 |
| 32 | AQ | 研究方向 |
| 33 | AR | 学习和工作经历 |
| 34 | AS | 申报人基本情况 |
| 35 | AT | 个人简述 |
| 36 | AU | 项目经历 |
| 37 | AV | 论文 |
| 38 | AW | 论文其中顶刊详细信息（记录影响因子大于30的期刊信息） |
| 39 | AX | 专利 |
| 40 | AY | 奖项荣誉和其他成果 |
| 41 | AK | 能否说中文 |

> 注意：NO 与列字母的对应是产品/模板约定；其中 NO.27 对应列为 **AN**、NO.41 对应 **AK**，与常见字母顺序不同，以代码映射为准。

### 5.1 「重点」列与提示文案（人工核对）

`RESUME_PROCESS_SECONDARY_IMPORTANT_COLUMNS` 定义了列字母 → 短说明，用于表格「重点」列及顶部提示卡片 `RESUME_PROCESS_SECONDARY_IMPORTANT_COLUMNS_NOTICE_TEXT`：

- **K**：姓名必填  
- **M**：出生日期缺失时需补齐（默认 1900-01-01）  
- **P**：来源地/国必填  
- **S**：证件号缺失时需填：无+客户号  
- **T**：证件过期日缺失时需补齐（默认 1900-01-01）  
- **V / W / X**：个人邮箱、工作邮箱、手机号需唯一  
- **AK**：能否说中文  
- **AL / AM / AO / AP**：同业竞争信息、（省/国）入选信息、备注、重要沟通记录  

---

## 6. 生成文本约定（与后端协作）

前端解析依赖 **`generated_text` 中出现形如 `NO.{1-41}###` 的标记**；标记后到下一 `NO.*###` 或文本结尾之间的内容视为该字段值。

若后端改为结构化 JSON 或变更标记格式，需同步修改  
`resume-process-secondary-parser.ts` 中的正则与 `cleanSegmentValue` 逻辑。

---

## 7. 小结

| 问题 | 答案摘要 |
|------|----------|
| 二次生成后前端主要从哪取数？ | `GET /resume-process/jobs/{id}` 返回的 `secondary_results[].generated_text`，以及 `job.secondary_status`、`secondary_run` 等元数据。 |
| 表格一行代表什么？ | 解析出的 `ResumeProcessFieldMapping`：`no` + Excel `column` + 中文 `header` + 正文 `value`。 |
| 中文/英文/序号分别指什么？ | **序号**：NO.1～NO.41；**英文列**：Excel 列字母（K、L…）；**中文**：映射表中的表头与重点说明。部分表头内自带「英文」业务字段名（如博士毕业院校英文、就职单位英文）。 |
| 如何刷新？ | 进入页面 `load()`；触发二次生成后 `load(run_id)`；SSE 推送后节流调用 `load()`。 |

文档生成依据：仓库内 `frontend` 当前实现；若接口或映射表有变更，请以 `types`、`lib`、`mapping` 源码为准更新本文档。
