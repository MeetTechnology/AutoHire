# 材料审查外部后端集成说明

**文档目的**：向实现「材料审查 AI 后端」的研发说明 AutoHire 当前工程中的**真实契约**（非设计草案）。外部服务按本文实现并配置环境变量后，AutoHire 将 `MATERIAL_REVIEW_MODE` 切换为 `live` 应能稳定跑通补件审查闭环。

**权威源码**（若与本文冲突，以代码为准）：

- `src/lib/material-review/live.ts` — AutoHire 调 GO_EIIE 的 HTTP 路径、请求体、响应解析（Zod）
- `src/app/api/internal/material-review/applications/[applicationId]/context/route.ts` — GO_EIIE 反向读取 AutoHire 申请上下文的只读 API
- `src/lib/material-review/context.ts` — 申请上下文、材料文件与下载 URL 组装
- `src/lib/material-review/types.ts` — 类型与枚举
- `src/lib/env.ts` — 环境变量名与默认值
- `src/lib/material-supplement/service.ts` — `syncSupplementReviewRun` 何时落库类别结果
- `src/lib/material-supplement/schemas.ts` — 回调 Body 与 Header 校验
- `src/lib/material-supplement/internal-auth.ts` — 回调签名算法与时钟容差

**关联规格**（产品语义与 AutoHire 自有 API，非外部 HTTP 合约）：

- `API_Spec_AI_Material_Supplement.md`
- `Light_RFC_AI_Material_Supplement.md`（提示词由外部后端管理）

---

## 1. 架构角色

| 组件                                 | 职责                                                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| **AutoHire（Next.js）**              | 专家 session、申请与补件数据、上传、调用审查后端、轮询 sync 或接收回调、结果入库与页面展示                          |
| **材料审查外部后端（本文读者实现）** | 接收 `applicationId`（及类别）、异步执行审查、返回 `externalRunId` 与可查询的结构化结果；提示词与模型调用在本侧完成 |

AutoHire **不会**在三条对外 HTTP 中发送简历全文、材料文件二进制或 OSS 直链；**仅**发送 `applicationId`（及 `category`）。GO_EIIE 需在 worker 内通过 AutoHire 只读上下文 API 反向拉取审查所需数据与文件下载 URL。

### 1.1 GO_EIIE 反向读取 AutoHire 上下文

AutoHire 侧提供只读内部接口：

```http
GET /api/internal/material-review/applications/{applicationId}/context
Authorization: Bearer <MATERIAL_REVIEW_API_KEY>
Accept: application/json
```

查询参数：

| 参数                    | 说明                                                                                                |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| `category`              | 可选；限定返回某一类材料。取值：`IDENTITY`、`EDUCATION`、`EMPLOYMENT`、`PROJECT`、`PATENT`、`HONOR` |
| `includeResume`         | 可选；默认 `true`；传 `false` 时 `resume` 返回 `null`                                               |
| `downloadUrlTtlSeconds` | 可选；默认 `900`；允许 `60..3600`                                                                   |

响应固定包含 `applicationId`、`expert`、`resume`、`materials`、`generatedAt`。`materials` 始终按六类 key 返回；传入 `category` 时，非目标类别为空数组。每个文件项包含 `objectKey` 与短期可读 `downloadUrl`，GO_EIIE 应优先使用 `downloadUrl` 下载文件。

鉴权复用 `MATERIAL_REVIEW_API_KEY`：同一个 Bearer Key 同时用于 AutoHire 调 GO_EIIE 的 `/reviews/*`，以及 GO_EIIE 调 AutoHire 的只读上下文 API。

---

## 2. AutoHire 侧环境变量（运维对齐）

| 变量                              | 必填（live）                     | 说明                                                                        |
| --------------------------------- | -------------------------------- | --------------------------------------------------------------------------- |
| `MATERIAL_REVIEW_MODE`            | 是                               | 必须为 `live` 才会调用真实 HTTP                                             |
| `MATERIAL_REVIEW_BASE_URL`        | 是                               | 审查服务根 URL，末尾 `/` 可有可无；路径会拼在其后                           |
| `MATERIAL_REVIEW_API_KEY`         | 是                               | 以 `Authorization: Bearer <值>` 发送；同时保护 AutoHire 只读上下文 API      |
| `MATERIAL_REVIEW_CALLBACK_SECRET` | 仅在使用**推送回调** AutoHire 时 | 见第 8 节；仅轮询可不配（但 AutoHire 回调路由在校验时会要求已配置才能通过） |

说明：`getEnv()` 在进程内缓存，**修改 `.env` 后需重启** AutoHire 服务。

参考：`.env.example` 中的同名变量。

---

## 3. 通用 HTTP 约定

- **鉴权**：所有请求必须包含  
  `Authorization: Bearer <MATERIAL_REVIEW_API_KEY>`
- **POST**：`Content-Type: application/json`
- **超时**：AutoHire 客户端单次请求约 **15 秒**（`live.ts` 中 `REQUEST_TIMEOUT_MS`）。创建任务应**快速返回**（建议返回 `QUEUED` / `PROCESSING` + `externalRunId`），长时推理放异步 worker。
- **成功响应**：HTTP **2xx**，且 `Content-Type` 含 `application/json` 时按 JSON 解析；否则解析可能失败。
- **失败响应**：非 2xx 时，Body 建议为 JSON，且尽量包含：  
  `{ "message": "人类可读说明", "retryable": true | false }`  
  AutoHire 对 `429` 与 **5xx** 倾向视为可重试；其它状态会参考 `retryable`。

---

## 4. 必须实现的三个接口

以下路径均相对于 `MATERIAL_REVIEW_BASE_URL`（即完整 URL = `BASE_URL` + 路径，BASE 尾部斜杠会被规范化）。

### 4.1 `POST /reviews/initial` — 首轮审查（六类）

**请求体（仅字段）：**

```json
{
  "applicationId": "string"
}
```

**成功响应（200）必填字段：**

- `externalRunId` **或** `external_run_id`：非空字符串，全局唯一，后续 `GET` 路径使用；建议仅使用 URL 安全字符。
- `status`：见第 5 节「任务状态」。

**可选：**`startedAt` / `started_at`、`finishedAt` / `finished_at`（可为 `null`）。

**示例：**

```json
{
  "externalRunId": "mr-initial-7f3a9c",
  "status": "QUEUED",
  "startedAt": "2026-05-11T10:00:00.000Z",
  "finishedAt": null
}
```

---

### 4.2 `POST /reviews/categories/{category}` — 单类补件后审查

**路径参数 `category`**（需与之一致，区分大小写）：

`IDENTITY` | `EDUCATION` | `EMPLOYMENT` | `PROJECT` | `PATENT` | `HONOR`

**请求体：**

```json
{
  "applicationId": "string",
  "category": "IDENTITY"
}
```

（`category` 与路径通常一致；客户端会同时传路径与 body。）

**成功响应**：与 4.1 相同结构（新的 `externalRunId` 表示本轮类别审查任务）。

---

### 4.3 `GET /reviews/{externalRunId}` — 查询任务与结果

**路径参数**：创建接口返回的 `externalRunId`（已 URL 编码传输）。

**成功响应（200）必填：**

- `externalRunId` / `external_run_id`
- `status`（第 5 节）
- `categories`：数组；未完成时可为 `[]`

**当顶层 `status === "COMPLETED"` 时**（AutoHire 才会把类别结果写入业务库）：

`categories` 中**每一项**须包含：

| 字段                                      | 必填 | 说明                |
| ----------------------------------------- | ---- | ------------------- |
| `category`                                | 是   | 六类之一            |
| `status`                                  | 是   | 任务状态（第 5 节） |
| `resultPayload` **或** `result_payload`   | 是   | 对象，见下表        |
| `aiMessage` / `ai_message`                | 否   | 可为 `null`         |
| `rawResultPayload` / `raw_result_payload` | 否   | 任意 JSON，可省略   |

**`resultPayload` 内必填：**

| 字段                                              | 必填 | 说明               |
| ------------------------------------------------- | ---- | ------------------ |
| `supplementRequired` **或** `supplement_required` | 是   | 布尔               |
| `requests`                                        | 是   | 数组（可为空数组） |

**`requests[]` 每项：**

- `title`：**必填**，非空字符串。
- `reason`：可选，字符串或 `null`。
- `suggestedMaterials` / `suggested_materials`：可选，字符串数组。
- `aiMessage` / `ai_message`：可选，字符串或 `null`。
- `status`：可选；若提供，须为下列之一：  
  `PENDING` | `UPLOADED_WAITING_REVIEW` | `REVIEWING` | `SATISFIED` | `HISTORY_ONLY`

**首轮建议在 `COMPLETED` 时返回六类各一条**（与 AutoHire 产品「六类审查」一致）；若某类无补件需求，可 `supplementRequired: false` 且 `requests: []`。

**示例（片段）：**

```json
{
  "externalRunId": "mr-initial-7f3a9c",
  "status": "COMPLETED",
  "startedAt": "2026-05-11T10:00:00.000Z",
  "finishedAt": "2026-05-11T10:02:00.000Z",
  "categories": [
    {
      "category": "IDENTITY",
      "status": "COMPLETED",
      "aiMessage": "Please upload a clearer ID scan.",
      "resultPayload": {
        "supplementRequired": true,
        "requests": [
          {
            "title": "Legible government ID",
            "reason": "Image is too blurry.",
            "suggestedMaterials": ["Passport photo page"],
            "status": "PENDING"
          }
        ]
      }
    },
    {
      "category": "EDUCATION",
      "status": "COMPLETED",
      "aiMessage": null,
      "resultPayload": {
        "supplementRequired": false,
        "requests": []
      }
    }
  ]
}
```

**进行中示例（AutoHire 不会写入类别明细）：**

```json
{
  "externalRunId": "mr-initial-7f3a9c",
  "status": "PROCESSING",
  "startedAt": "2026-05-11T10:00:00.000Z",
  "finishedAt": null,
  "categories": []
}
```

若 JSON 形状与上述不符，AutoHire 会抛出 **`RESULT_INVALID`** 类错误，专家侧可能看到同步失败。

---

## 5. 任务状态枚举

字符串比较**不区分大小写**；以下为大写规范写法。

| 值           | 说明                                                                      |
| ------------ | ------------------------------------------------------------------------- |
| `QUEUED`     | 已排队；`PENDING` 在客户端会被映射为 `QUEUED`                             |
| `PROCESSING` | 执行中                                                                    |
| `COMPLETED`  | 成功结束；**此时** AutoHire sync 才消费 `categories` 中的 `resultPayload` |
| `FAILED`     | 失败                                                                      |

**AutoHire sync 行为摘要**（`syncSupplementReviewRun`）：仅当 `GET` 返回的**顶层** `status === "COMPLETED"` 时，才把 `categories` 映射入库；否则 `categories` 在同步逻辑中按空处理，只更新运行状态。

---

## 6. 与 AutoHire 业务流程的时序（便于你们做异步）

1. 专家最终提交申请 → AutoHire 触发首轮 → **`POST /reviews/initial`**，保存返回的 `externalRunId`。
2. AutoHire 前端或接口轮询 **`POST .../material-supplement/reviews/{reviewRunId}/sync`**（这是 AutoHire **自有** API，不是你们实现的），其内部调用你们的 **`GET /reviews/{externalRunId}`**。
3. 专家在补件页上传并确认批次 → AutoHire 触发 **`POST /reviews/categories/{category}`**，再同样经 sync 轮询 **`GET`**。

因此：**GET 必须对同一 `externalRunId` 幂等、状态单调演进**（至少从业务上可理解），且完成后一次性给出合法 `COMPLETED` + `categories`。

---

## 7. 业务常量（与 AutoHire 一致，供你们校验或提示）

| 项                           | 值                                            |
| ---------------------------- | --------------------------------------------- |
| 支持审查类别                 | 上表六类（`SUPPORTED_SUPPLEMENT_CATEGORIES`） |
| 单类别单批次最大文件数       | 10                                            |
| 每申请最大审查轮次（含首轮） | 3                                             |

常量定义见：`src/features/material-supplement/constants.ts`。

---

## 8. 可选：主动推送结果到 AutoHire（回调）

AutoHire 提供内部路由（由**你们作为 HTTP 客户端**调用）：

```text
POST {APP_BASE_URL}/api/internal/material-supplement/reviews/{reviewRunId}/callback
```

- `APP_BASE_URL`：AutoHire 部署根地址（`src/lib/env.ts` 中 `APP_BASE_URL`）。
- `{reviewRunId}`：**AutoHire 内部**的审查运行 ID（**不是** `externalRunId`）。

### 8.1 请求头（鉴权）

| Header                        | 说明                                                                                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `x-material-review-timestamp` | ISO 8601 **带时区偏移**的日期时间字符串                                                                                                        |
| `x-material-review-signature` | `hex( HMAC_SHA256( MATERIAL_REVIEW_CALLBACK_SECRET, timestamp + "." + rawBody ) )`，其中 `rawBody` 为 **原始 JSON 字符串**（与 Body 字节一致） |

时钟容差：服务端校验时允许与 AutoHire 服务器时间相差约 **5 分钟**（见 `internal-auth.ts`）。

### 8.2 请求体 JSON（与 `supplementReviewCallbackBodySchema` 一致）

必填顶层字段：

- `externalRunId`：非空字符串，须与 AutoHire 库中该 `reviewRunId` 对应运行所存的值一致。
- `status`：`QUEUED` | `PROCESSING` | `COMPLETED` | `FAILED`
- `categories`：数组；结构与第 4.3 节类似，但每项为：
  - `category`：六类之一
  - `status`：同上四种之一
  - `resultPayload`：`{ supplementRequired: boolean, requests: [...] }`（`requests` 每项须含非空 `title`，且 `status` 为第 4.3 节所列补件需求状态之一）
  - `reviewedAt`：可选，ISO 8601 **带偏移**
  - `aiMessage`：可选
  - `rawResultPayload`：可选

可选顶层：`finishedAt`（ISO 8601 带偏移）。

### 8.3 已知集成缺口（必读）

当前 **`POST /reviews/initial` 与 `POST /reviews/categories/...` 的请求体中不包含 `reviewRunId`**，也不包含完整回调 URL。因此仅凭现有 AutoHire 发往你们的创建请求，**无法**拼出上述回调路径中的 `{reviewRunId}`。

**可行做法：**

- **推荐（零改 AutoHire）**：仅依赖 **`GET /reviews/{externalRunId}`** + AutoHire 侧 **sync 轮询** 完成闭环。
- **若必须推送回调**：需与 AutoHire 研发团队约定**扩展创建请求体**（例如增加 `reviewRunId` 或 `callbackUrl`），并同步修改 `src/lib/material-review/live.ts` 后，再按本文第 8 节实现调用方。

---

## 9. 自检清单（上线 live 前）

- [ ] `POST /reviews/initial` 与 `POST /reviews/categories/:category` 在 15 秒内返回 2xx 与合法 JSON。
- [ ] `externalRunId` 唯一且 `GET` 可查询。
- [ ] `GET` 在 `COMPLETED` 时 `categories` 每项含 `resultPayload.supplementRequired` 与 `requests`；`title` 均非空。
- [ ] 状态从 `QUEUED`/`PROCESSING` 到 `COMPLETED` 或 `FAILED` 行为符合第 6 节。
- [ ] 已明确根据 `applicationId` 拉取简历与六类材料的方案（本文第 1 节）。
- [ ] 若使用回调：已解决 `reviewRunId` 获取问题（第 8.3 节），且签名与 `MATERIAL_REVIEW_CALLBACK_SECRET` 一致。

---

## 10. 文档维护

- 本文随 `live.ts` / `schemas.ts` 变更更新版本号。
- **版本**：1.0.0
- **依据提交**：以仓库当前 `main` 或发布分支中上述文件为准。
