# 简历二次生成：模型返回结果的读取方式与字段说明

本文说明在 **`resume-process` 流水线完成二次生成之后**，后端如何从 LLM 原始输出得到入库文本、客户端如何通过 API 读取、以及 **导出 Excel 时** 如何将文本解析为「编号槽位」并写入模板。实现代码主要位于：

- `internal/core/services/resume_process_service.go`（`processSecondaryOne`、`GenerateTemplateExport`）
- `internal/core/services/resume_process_result_parser.go`（`extractResultBody`、`parseNOBlocks` 等）
- `internal/core/services/resume_process_exporter.go`（`fillTemplateWithMapping`）
- `internal/core/models/resume_process.go`（`ResumeSecondaryResult` 等持久化结构）

---

## 1. 总体数据流（二次生成一条提示词）

```
LLM 原始输出 res.Text
    ↓ extractResultBody（可选剥离 <result> 包裹层）
    ↓ 写入数据库字段 generated_text
    ↓
客户端：GET 任务详情 / GET secondary-results → 读取 JSON 中的 generated_text（按 prompt_id 区分）
    ↓（仅导出接口）
parseNOBlocks（从多条 generated_text 拼文中解析 NO.n 槽位）
    ↓ fillTemplateWithMapping（槽位 n → Excel 单元格）
    ↓ 生成 .xls 文件流
```

要点：**二次生成不会在服务端把模型输出解析成固定 JSON 业务字段再入库**；持久化的是 **一段文本**（`generated_text`）。**结构化槽位解析**只发生在 **导出模板** 路径（`parseNOBlocks` + Excel 映射）。若你需要在自有系统中做字段级解析，应复用相同约定（见第 4～5 节）或自行解析 `generated_text`。

---

## 2. 从模型返回到入库：`extractResultBody`

**调用位置**：`processSecondaryOne` 在 LLM 调用成功且 `res.Text` 非空后执行：

```text
text := extractResultBody(res.Text)
```

**逻辑**（`resume_process_result_parser.go`）：

1. 对 `res.Text` 做 `TrimSpace`。
2. 用正则（不区分大小写、单行/多行）匹配：`<result>\s*(.*?)\s*</result>`。
3. **若匹配成功**：返回 **第一个** `<result>...</result>` 内部的文本（再 `TrimSpace`），作为入库内容。
4. **若未匹配**：返回 **整段** `TrimSpace` 后的原始文本。

**含义**：

- 提示词可要求模型把「最终可展示/可解析」内容放在 `<result>...</result>` 中，其它分析过程放在标签外；后端只持久化标签内正文，减少杂质。
- 若模型未按约定输出标签，系统仍保存完整正文，避免丢数据。

**与单元测试一致的行为示例**（见 `resume_process_service_test.go`）：

- 输入含 `<result>【1】：A\n【2】：B</result>` 时，入库为 `【1】：A\n【2】：B`（**注意**：这里的 `【n】` 样式来自测试用例；**交互式二次导出的槽位解析见第 4 节 `NO.n###`，二者用途不同**）。

**另**：`res.Thinking`（若有）不会写入 `generated_text`，而是追加写入源简历文件的附加说明块（`appendThinkingSummaryToFiles`），与 API 返回的 `generated_text` 无关。

---

## 3. 数据库与 API 层：你能读到哪些字段

每条二次生成记录对应表模型 **`ResumeSecondaryResult`**（JSON 字段名与 struct tag 一致）。

### 3.1 表 / API 字段一览

| 字段 | 类型 | 含义 |
|------|------|------|
| `id` | uint | 本条结果行主键 |
| `job_id` | uint | 所属简历处理任务 |
| `secondary_run_id` | uint | 所属二次批次（即接口中的 `run_id`） |
| `prompt_id` | uint | 使用的提示词模板 ID（对应 `prompts` 表），用于区分「哪一条提示词产出」 |
| **`generated_text`** | string | **模型经 `extractResultBody` 处理后的正文**；业务上应满足提示词与导出约定（如 `NO.n###` 块，见第 4 节） |
| `status` | string | `processing` / `completed` / `error` |
| `error_message` | string 或 null | 该提示词失败时的错误信息 |
| `created_at` / `updated_at` | 时间 | 记录时间 |

### 3.2 通过 HTTP 读取

二次完成后，典型读取方式：

1. **`GET /api/v1/resume-process/jobs/{jobId}?run_id=可选`**  
   响应体 `ResumeProcessJobDetail` 中的 `secondary_results` 数组，每项含上述字段。

2. **`GET /api/v1/resume-process/jobs/{jobId}/secondary-results?run_id=可选`**  
   响应体为 `{ "run": {...}, "items": [ ... ] }`，`items` 同上。

**注意**：列表顺序为服务层查询顺序（按 `id ASC`）；若存在 **重试批次**（`retry_of_run_id`），`listEffectiveSecondaryResults` 会合并父批次成功项与当前批次结果，用于展示与导出（见 `resume_process_repository.go` 注释）。

### 3.3 `run`（批次）对象中与「结果内容」相关的字段

`ResumeSecondaryRun` 更偏 **批次元数据**，其中与内容质量相关的字段包括：

| 字段 | 含义 |
|------|------|
| `prompt_ids` | 本批次规划的提示词 ID 列表 |
| `failed_prompt_ids` | 本批次失败的提示词 ID（部分成功时尤其重要） |
| `status` | 批次整体：`pending` / `processing` / `retrying` / `completed` / `completed_partial` / `failed` |
| `total_prompts` / `completed_prompts` / `error_prompts` | 统计 |
| `error_message` | 批次级汇总（如列出失败 prompt id） |

正文内容仍以每条 `ResumeSecondaryResult.generated_text` 为准。

---

## 4. 导出路径：如何从 `generated_text` 解析出「槽位字段」

导出接口 **`GET /api/v1/resume-process/jobs/{jobId}/export-template`** 内部逻辑：

1. `ListSecondaryResults` 得到该 `run` 下（及合并规则下的）全部 `items`。
2. `parsed := parseNOBlocks(items)` → 得到 `map[int]string`，**key 为槽位编号 `n`，value 为该槽位正文**。
3. `fillTemplateWithMapping(ctx, parsed)` 把每个 `n` 写入 Excel 指定列第 3 行（见第 5 节）。

### 4.1 `parseNOBlocks` 的输入如何处理

1. 按 `items` **顺序**遍历每条 `GeneratedText`：
   - `TrimSpace`；
   - 若整体被一对双引号包裹，则去掉首尾 `"`（兼容模型输出 JSON 字符串风格）。
2. 将所有非空片段用 **换行符 `\n`** 拼成 **`allText`**（多提示词、多段输出会在同一字符串中连续解析）。

### 4.2 槽位标题格式（必须可被正则识别）

使用正则：`NO\.(\d+)\s*###`

即文本中需出现类似：

```text
NO.1###这里是第 1 槽内容
NO.2###第二槽
```

- **`NO.`** 与数字 **`n`** 之间无空格（正则要求 `NO.` 紧邻数字）。
- 数字后为 **`###`**（三个 `#`），**`###` 与正文之间无强制换行**，但测试用例中常见换行或紧贴下一标题。

### 4.3 每个槽位正文的起止范围

- **起点**：匹配到的 `NO.n###` 整段匹配 **结束之后** 到下一个 `NO.m###` 开头之前，为编号 **`n`** 的片段。
- **提前结束**：若片段内出现 **`井井井`** 三个汉字，则只取该标记 **之前** 的内容（用于截断模型多余输出）。
- **尾部清理**：
  - 去掉首尾空白与包裹引号；
  - 若以 `###` 结尾则去掉该结尾 `###` 及周围空白；
  - 若去完后仅为 `###` 则视为空串，**不写入**该 key。

### 4.4 特殊字符：`^^^` → 换行（仅导出写 Excel 时）

在 **`fillTemplateWithMapping`** 写入单元格前，会把值中的 **`^^^` 全部替换为换行符 `\n`**（便于在单个槽位内输出多行地址、经历等）。

**`parseNOBlocks` 本身不替换 `^^^`**；替换发生在填表阶段。若只读 API 不做导出，需在客户端自行替换或保留原样。

### 4.5 与「批量简历」解析的区别（避免混淆）

| 能力 | 解析函数 | 典型格式 | 用途 |
|------|----------|----------|------|
| **交互式 resume-process 二次 + 导出** | `parseNOBlocks` | `NO.n###` 正文… | 映射到导入模板 Excel 列 |
| **批量任务** `RESUME_BATCH_SECONDARY_*` | `ParseResumeBatchSecondaryResults` 等 | 行首 `【n】：` / `[n]:` 等 | 强类型字段（出生年、国家等），见 `resume_batch_parser.go` |

交互式二次生成 **默认不走** 批量解析器；除非你自行在业务层调用批量解析并约定模型输出 `【n】` 格式。

---

## 5. 槽位编号 `n` 与 Excel 列的对应关系（代码硬编码）

配置项 **`storage.resume_process_template_path`** 指向 **`.xls` 模板文件**；导出时优先使用工作表名 **`导入模板2026-01-20`**（见 `resume_process_exporter.go`）。

**槽位 `n`（`parseNOBlocks` 得到的 map key）与模板第 3 行列号对应关系如下**（与业务模板列标题一一对应；**具体业务含义以模板表头 / 产品文档为准**，仓库内仅硬编码列字母）：

| 槽位 n | Excel 列 | 槽位 n | Excel 列 | 槽位 n | Excel 列 |
|--------|----------|--------|----------|--------|----------|
| 1 | K | 15 | Y | 29 | AM |
| 2 | L | 16 | Z | 30 | AO |
| 3 | M | 17 | AA | 31 | AP |
| 4 | N | 18 | AB | 32 | AQ |
| 5 | O | 19 | AC | 33 | AR |
| 6 | P | 20 | AD | 34 | AS |
| 7 | Q | 21 | AE | 35 | AT |
| 8 | R | 22 | AF | 36 | AU |
| 9 | S | 23 | AG | 37 | AV |
| 10 | T | 24 | AH | 38 | AW |
| 11 | U | 25 | AI | 39 | AX |
| 12 | V | 26 | AJ | 40 | AY |
| 13 | W | 27 | AN | 41 | AK |
| 14 | X | 28 | AL | | |

说明：

- 仅当 `values[n]` 非空白时才会写入对应单元格。
- 默认还会写入 **`I3` = `海外人才`**（`defaultCells`），与槽位无关。
- 若 `parseNOBlocks` 未解析出任何槽位（例如模型未输出 `NO.n###`），导出可能得到大量空列或不符合导入预期，需从 **提示词模板** 侧约束输出格式。

---

## 6. 客户端 / 集成方建议

1. **只关心原文**：直接读 `secondary_results[].generated_text` 与 `prompt_id`，自行约定 JSON 或其它结构（需与提示词一致）。
2. **与导出一致**：在合并后的文本上复现 `NO.n###` 与 `井井井`、`^^^` 规则，再按上表映射到业务字段。
3. **排查无字段**：检查模型是否使用 `<result>`、是否在 `<result>` 内输出 `NO.n###`、编号是否与模板列一致。
4. **与初次分析区分**：初次结果在 `ResumeInitialResult` 的 `raw_response` / `parsed_result`（可能为 JSON），解析逻辑见 `resume_process_service.go` 中初次任务完成分支；**与二次 `generated_text` 无自动合并**。

---

## 7. 相关源码索引

| 主题 | 位置 |
|------|------|
| 二次单条 LLM 写库 | `ResumeProcessService.processSecondaryOne` |
| `<result>` 剥离 | `extractResultBody` |
| `NO.n###` 解析 | `parseNOBlocks` |
| Excel 填槽 | `fillTemplateWithMapping`、`utils.FillXlsTemplateWithExcelCOM` |
| 批量另一种格式 | `resume_batch_parser.go`（`【n】` 等，非本流水线导出默认路径） |

---

*文档生成依据仓库当前实现；若后续修改正则、槽位数量或模板工作表名，请同步更新本文与 `docs/resume-process-api.md`。*
