# Database Schema Spec

## 1. 数据库设计总览

本数据库设计用于支持“提交后的 AI 材料补件闭环”。

设计目标：

- 在不改变现有申请主流程的前提下，保存 AI 材料审查结果。
- 补件文件独立于现有原材料文件，不写入原 `ApplicationMaterial`。
- 每一轮审查结果长期保存。
- 每个类别的 latest 结果可快速读取。
- 已满足需求默认隐藏，但历史可追溯。
- 支持首轮全类别审查和后续单类别审查。
- 支持每个申请默认最多 3 轮补件审查。
- 支持单次单类别最多 10 个补件文件。
- 支持同一申请、同一类别下同文件名 + 同文件大小去重。

### 1.1 复用现有表

以下现有表继续复用：

- `Application`：申请主记录。补件流程仅允许 `SUBMITTED` 申请进入。
- `ApplicationMaterial`：原材料上传记录。仅用于首轮审查输入，不保存补件文件。
- `ResumeFile`：简历文件记录。用于定位简历来源。
- `ResumeAnalysisResult`：简历模型提取结果。首轮审查使用模型提取的简历信息。
- `ApplicationEventLog`：可复用记录补件触发、上传、审查同步等事件。
- `FileUploadAttempt`：可复用记录补件上传 intent、PUT、confirm 等过程，或新增补件上传字段【待确认】。

### 1.2 建议新增表

新增核心表：

- `MaterialReviewRun`
- `MaterialCategoryReview`
- `SupplementRequest`
- `SupplementUploadBatch`
- `SupplementFile`

可选新增表：

- `SupplementReviewSyncLog`：用于记录外部 AI 审查服务同步/回调日志【待确认】。

### 1.3 命名说明

本规格使用 TypeScript/Prisma 风格字段名，例如 `applicationId`、`createdAt`。如果数据库采用 snake_case，迁移时可映射为 `application_id`、`created_at`。

字段类型以通用关系型数据库表达。具体 ORM 类型以最终技术栈为准【待确认】。

## 2. 表结构

### 2.1 `MaterialReviewRun`

用途：

记录一次申请维度的材料审查运行。首轮审查覆盖 6 个类别；后续审查通常只覆盖单个类别。

| 字段名 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | String / cuid | 是 | 自动生成 | 主键 |
| `applicationId` | String | 是 | 无 | 关联 `Application.id` |
| `runNo` | Int | 是 | 无 | 该申请下的审查轮次，从 1 开始 |
| `status` | Enum | 是 | `QUEUED` | 审查运行状态 |
| `triggerType` | Enum | 是 | 无 | 触发类型：首轮自动触发或补件上传触发 |
| `triggeredCategory` | Enum / String | 否 | null | 后续单类别审查时记录触发类别；首轮可为空 |
| `externalRunId` | String | 否 | null | 外部 AI 审查后端返回的 run/task ID |
| `errorMessage` | Text | 否 | null | 兜底错误信息；正常情况下后端默认返回成功 |
| `startedAt` | DateTime | 否 | null | 审查开始时间 |
| `finishedAt` | DateTime | 否 | null | 审查完成时间 |
| `createdAt` | DateTime | 是 | now | 创建时间，审计字段 |
| `updatedAt` | DateTime | 是 | now / auto update | 更新时间，审计字段 |

建议枚举：

```text
MaterialReviewRunStatus:
- QUEUED
- PROCESSING
- COMPLETED
- FAILED

MaterialReviewTriggerType:
- INITIAL_SUBMISSION
- SUPPLEMENT_UPLOAD
- MANUAL_RETRY
```

说明：

- `FAILED` 是兜底状态。产品约定外部后端会自动重试，并默认向当前项目返回成功。
- `MANUAL_RETRY` 预留给后续运维或人工复核。
- 是否需要 `externalRunId` 唯一约束取决于外部服务是否保证全局唯一【待确认】。

### 2.2 `MaterialCategoryReview`

用途：

记录某个审查 run 下某个材料类别的审查结果。每个类别可以有多轮结果，最新结果通过 `isLatest=true` 查询。

| 字段名 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | String / cuid | 是 | 自动生成 | 主键 |
| `reviewRunId` | String | 是 | 无 | 关联 `MaterialReviewRun.id` |
| `applicationId` | String | 是 | 无 | 冗余关联 `Application.id`，便于查询 |
| `category` | Enum / String | 是 | 无 | 审查类别，仅支持 6 类 |
| `roundNo` | Int | 是 | 无 | 该类别下的审查轮次 |
| `status` | Enum | 是 | `QUEUED` | 类别审查状态 |
| `aiMessage` | Text | 否 | null | AI 生成的专家端英文说明 |
| `resultPayload` | Json | 否 | null | 外部后端返回的结构化审查结果 |
| `rawResultPayload` | Json / Text | 否 | null | AI 原始输出或外部后端原始结果【待确认】 |
| `isLatest` | Boolean | 是 | true | 是否为该申请该类别的最新结果 |
| `startedAt` | DateTime | 否 | null | 类别审查开始时间 |
| `finishedAt` | DateTime | 否 | null | 类别审查完成时间 |
| `createdAt` | DateTime | 是 | now | 创建时间，审计字段 |
| `updatedAt` | DateTime | 是 | now / auto update | 更新时间，审计字段 |

建议枚举：

```text
MaterialCategoryReviewStatus:
- QUEUED
- PROCESSING
- COMPLETED
- FAILED
```

支持类别枚举：

```text
SupplementCategory:
- IDENTITY
- EDUCATION
- EMPLOYMENT
- PROJECT
- PATENT
- HONOR
```

说明：

- Product、Paper、Book、Conference 不进入该表的第一阶段审查范围。
- 写入新一轮同类别结果时，应将旧同类别记录 `isLatest=false`。
- `resultPayload` 是当前项目读取和展示的主要结构。
- 是否保存 `rawResultPayload` 待确认。

### 2.3 `SupplementRequest`

用途：

保存 AI 生成的补件需求。专家默认只看到 `isLatest=true` 且未满足的需求；已满足和旧需求保留历史。

| 字段名 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | String / cuid | 是 | 自动生成 | 主键 |
| `applicationId` | String | 是 | 无 | 关联 `Application.id` |
| `category` | Enum / String | 是 | 无 | 所属审查类别 |
| `reviewRunId` | String | 是 | 无 | 关联 `MaterialReviewRun.id` |
| `categoryReviewId` | String | 是 | 无 | 关联 `MaterialCategoryReview.id` |
| `title` | String | 是 | 无 | 补件需求标题，英文 |
| `reason` | Text | 否 | null | 缺失或不符合要求的原因，英文 |
| `suggestedMaterials` | Json / Text | 否 | null | 建议上传的材料类型，可为数组或文本 |
| `aiMessage` | Text | 否 | null | 面向专家展示的完整英文说明 |
| `status` | Enum | 是 | `PENDING` | 补件需求状态 |
| `isLatest` | Boolean | 是 | true | 是否为当前最新需求 |
| `isSatisfied` | Boolean | 是 | false | 是否已满足 |
| `sourceRequestId` | String | 否 | null | 若该需求由旧需求演变而来，指向上一版本需求【待确认】 |
| `satisfiedAt` | DateTime | 否 | null | 满足时间 |
| `createdAt` | DateTime | 是 | now | 创建时间，审计字段 |
| `updatedAt` | DateTime | 是 | now / auto update | 更新时间，审计字段 |

建议枚举：

```text
SupplementRequestStatus:
- PENDING
- UPLOADED_WAITING_REVIEW
- REVIEWING
- SATISFIED
- HISTORY_ONLY
```

说明：

- 已满足需求默认不在补件页面主视图展示，但历史页可查看。
- 新一轮审查返回新原因时，应写入新 request 或更新 latest 需求的策略【待确认】。
- 为保证历史可追溯，建议新一轮结果创建新 request，并将旧 request 标记为 `isLatest=false` 或 `HISTORY_ONLY`。

### 2.4 `SupplementUploadBatch`

用途：

记录专家在某个类别下的一次批量补件上传。批量确认后触发该类别一次后续审查。

| 字段名 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | String / cuid | 是 | 自动生成 | 主键 |
| `applicationId` | String | 是 | 无 | 关联 `Application.id` |
| `category` | Enum / String | 是 | 无 | 上传所属类别 |
| `status` | Enum | 是 | `DRAFT` | 上传批次状态 |
| `fileCount` | Int | 是 | 0 | 该批次有效文件数量 |
| `reviewRunId` | String | 否 | null | 批次确认后触发的审查 run |
| `confirmedAt` | DateTime | 否 | null | 批量确认时间 |
| `createdAt` | DateTime | 是 | now | 创建时间，审计字段 |
| `updatedAt` | DateTime | 是 | now / auto update | 更新时间，审计字段 |

建议枚举：

```text
SupplementUploadBatchStatus:
- DRAFT
- CONFIRMED
- REVIEWING
- COMPLETED
- CANCELLED
```

说明：

- `DRAFT` 状态下允许删除本批次文件。
- `CONFIRMED` 后不允许修改本轮文件。
- `REVIEWING` 表示该批次已触发类别审查。
- `CANCELLED` 预留给用户未确认前清空批次。

### 2.5 `SupplementFile`

用途：

保存补件上传文件。该表独立于现有 `ApplicationMaterial`，补件文件不出现在原材料分类列表。

| 字段名 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | String / cuid | 是 | 自动生成 | 主键 |
| `applicationId` | String | 是 | 无 | 关联 `Application.id` |
| `category` | Enum / String | 是 | 无 | 文件所属补件类别 |
| `supplementRequestId` | String | 否 | null | 关联的补件需求；若按类别上传可为空【待确认】 |
| `uploadBatchId` | String | 是 | 无 | 关联 `SupplementUploadBatch.id` |
| `reviewRunId` | String | 否 | null | 触发审查后关联对应 run |
| `fileName` | String | 是 | 无 | 原始文件名 |
| `objectKey` | String | 是 | 无 | 文件存储 object key |
| `fileType` | String | 是 | 无 | MIME type 或上传类型 |
| `fileSize` | Int | 是 | 无 | 文件大小，单位 byte |
| `fileHash` | String | 否 | null | 内容 hash，用于更强去重【待确认】 |
| `isDeleted` | Boolean | 是 | false | 是否软删除 |
| `deletedAt` | DateTime | 否 | null | 删除时间，审计字段 |
| `uploadedAt` | DateTime | 是 | now | 上传确认时间 |
| `createdAt` | DateTime | 是 | now | 创建时间，审计字段 |
| `updatedAt` | DateTime | 是 | now / auto update | 更新时间，审计字段 |

说明：

- 同一申请、同一类别、同文件名、同文件大小视为重复文件。
- 是否使用 `fileHash` 参与去重待确认。
- 已确认并触发审查的文件不允许删除；若后续需要删除，应软删除并保留审计。

### 2.6 `SupplementReviewSyncLog`【可选】

用途：

记录当前项目与外部 AI 审查服务之间的同步或回调日志。用于排查外部服务调用、重复回调、结果同步失败等问题。

| 字段名 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | String / cuid | 是 | 自动生成 | 主键 |
| `applicationId` | String | 是 | 无 | 关联 `Application.id` |
| `reviewRunId` | String | 否 | null | 关联 `MaterialReviewRun.id` |
| `externalRunId` | String | 否 | null | 外部 run/task ID |
| `direction` | Enum | 是 | 无 | `OUTBOUND` 或 `INBOUND` |
| `eventType` | String | 是 | 无 | 事件类型，例如 create、poll、callback |
| `status` | Enum | 是 | 无 | 同步结果 |
| `requestPayload` | Json | 否 | null | 请求摘要，避免保存敏感文件内容 |
| `responsePayload` | Json | 否 | null | 响应摘要 |
| `errorMessage` | Text | 否 | null | 错误信息 |
| `createdAt` | DateTime | 是 | now | 创建时间，审计字段 |

建议枚举：

```text
SupplementReviewSyncDirection:
- OUTBOUND
- INBOUND

SupplementReviewSyncStatus:
- SUCCESS
- FAILED
- IGNORED
```

说明：

- 是否需要单独建表待确认。
- 也可以复用 `ApplicationEventLog` 记录。

### 2.7 `Application` 可选扩展字段

用途：

快速读取申请维度的补件状态。

| 字段名 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `materialSupplementStatus` | Enum | 否 | `NOT_STARTED` | 当前申请补件审查汇总状态【待确认】 |
| `latestMaterialReviewRunId` | String | 否 | null | 最新材料审查 run ID【待确认】 |

建议枚举：

```text
MaterialSupplementStatus:
- NOT_STARTED
- REVIEWING
- SUPPLEMENT_REQUIRED
- NO_SUPPLEMENT_REQUIRED
- PARTIALLY_SATISFIED
- SATISFIED
```

说明：

- 也可以不扩展 `Application`，完全由最新 `MaterialReviewRun` 和 latest `SupplementRequest` 推导。
- 为降低主表耦合，建议优先推导；如页面查询性能不足，再增加冗余字段。

## 3. 表关系

### 3.1 核心关系

```text
Application 1 - N MaterialReviewRun
Application 1 - N MaterialCategoryReview
Application 1 - N SupplementRequest
Application 1 - N SupplementUploadBatch
Application 1 - N SupplementFile

MaterialReviewRun 1 - N MaterialCategoryReview
MaterialReviewRun 1 - N SupplementRequest
MaterialReviewRun 1 - N SupplementFile

MaterialCategoryReview 1 - N SupplementRequest

SupplementUploadBatch 1 - N SupplementFile
SupplementUploadBatch 0/1 - 1 MaterialReviewRun

SupplementRequest 0/1 - N SupplementFile
```

### 3.2 与现有表关系

```text
Application 1 - N ApplicationMaterial
Application 1 - N ResumeAnalysisResult
Application 1 - N ResumeFile
Application 1 - N ApplicationEventLog
```

使用方式：

- `ApplicationMaterial`：首轮审查读取原已提交材料。
- `ResumeAnalysisResult`：首轮审查读取模型提取的简历信息。
- `ResumeFile`：用于定位简历来源。
- `ApplicationEventLog`：记录补件页面访问、审查触发、补件上传、同步结果等事件。

### 3.3 补件文件与原材料文件关系

补件文件不关联 `ApplicationMaterial`。

原因：

- 产品明确补件上传文件不会出现在原材料分类列表。
- 原 `/apply/materials` 提交后保持只读。
- 补件文件只在 `/apply/supplement` 和历史页展示。

## 4. 索引设计

### 4.1 `MaterialReviewRun`

建议索引：

- `applicationId`
- `applicationId, runNo`
- `applicationId, status`
- `externalRunId`
- `createdAt`

建议唯一约束：

- `applicationId, runNo`
- `externalRunId`【待确认，取决于外部服务唯一性】

用途：

- 快速读取申请最新 run。
- 防止同一申请重复生成相同 runNo。
- 支持外部回调按 externalRunId 定位。

### 4.2 `MaterialCategoryReview`

建议索引：

- `applicationId, category`
- `applicationId, category, isLatest`
- `reviewRunId`
- `status, updatedAt`

建议唯一约束：

- `reviewRunId, category`
- `applicationId, category, roundNo`

用途：

- 补件页面快速读取 6 个类别 latest 状态。
- 历史页按类别筛选。
- 防止同一 run 下重复写入同类别结果。

### 4.3 `SupplementRequest`

建议索引：

- `applicationId, category, isLatest`
- `applicationId, status`
- `applicationId, isSatisfied`
- `reviewRunId`
- `categoryReviewId`

用途：

- 快速读取当前待补件需求。
- 快速隐藏已满足需求。
- 历史页按 run/category 查询。

### 4.4 `SupplementUploadBatch`

建议索引：

- `applicationId, category`
- `applicationId, status`
- `reviewRunId`
- `createdAt`

用途：

- 查询当前类别是否有草稿批次。
- 查询批次对应审查 run。

### 4.5 `SupplementFile`

建议索引：

- `applicationId, category`
- `applicationId, uploadBatchId`
- `reviewRunId`
- `supplementRequestId`
- `applicationId, category, fileName, fileSize`
- `applicationId, category, isDeleted`

建议唯一约束【待确认】：

- `applicationId, category, fileName, fileSize`，仅对未删除文件生效；是否支持部分唯一索引取决于数据库。

用途：

- 补件页面读取类别文件。
- 处理同名同大小文件去重。
- 历史页展示某轮上传文件。

### 4.6 `SupplementReviewSyncLog`【可选】

建议索引：

- `applicationId, createdAt`
- `reviewRunId, createdAt`
- `externalRunId`
- `status, createdAt`

用途：

- 排查外部服务同步和回调问题。

## 5. 状态字段说明

### 5.1 `MaterialReviewRun.status`

用于审查 run 级别状态流转。

```text
QUEUED -> PROCESSING -> COMPLETED
QUEUED -> PROCESSING -> FAILED
```

说明：

- 首轮审查创建后进入 `QUEUED`。
- 外部后端开始处理后进入 `PROCESSING`。
- 所有目标类别返回结果后进入 `COMPLETED`。
- 外部服务兜底失败时进入 `FAILED`。

### 5.2 `MaterialCategoryReview.status`

用于类别级状态流转。

```text
QUEUED -> PROCESSING -> COMPLETED
QUEUED -> PROCESSING -> FAILED
```

说明：

- 补件页面按类别状态决定是否禁用上传。
- 某类别最新 review 为 `PROCESSING` 时，该类别上传、删除、提交审查按钮禁用。
- 其他类别不受影响。

### 5.3 `SupplementRequest.status`

用于补件需求展示和历史。

```text
PENDING -> UPLOADED_WAITING_REVIEW -> REVIEWING -> SATISFIED
PENDING -> HISTORY_ONLY
SATISFIED -> HISTORY_ONLY
```

说明：

- `PENDING`：当前需要专家补件。
- `UPLOADED_WAITING_REVIEW`：专家已上传文件，但尚未触发或完成审查。
- `REVIEWING`：对应类别正在审查。
- `SATISFIED`：该需求已满足，默认隐藏。
- `HISTORY_ONLY`：旧需求或旧结果，仅历史页展示。

### 5.4 `SupplementUploadBatch.status`

用于补件批量上传状态。

```text
DRAFT -> CONFIRMED -> REVIEWING -> COMPLETED
DRAFT -> CANCELLED
```

说明：

- `DRAFT`：用户选择文件后、确认审查前。
- `CONFIRMED`：批次已确认，不允许修改。
- `REVIEWING`：已触发类别审查。
- `COMPLETED`：对应类别审查完成。
- `CANCELLED`：用户取消草稿批次。

### 5.5 `Application.materialSupplementStatus`【可选】

用于申请维度补件汇总状态。

```text
NOT_STARTED -> REVIEWING -> SUPPLEMENT_REQUIRED
NOT_STARTED -> REVIEWING -> NO_SUPPLEMENT_REQUIRED
SUPPLEMENT_REQUIRED -> PARTIALLY_SATISFIED -> SATISFIED
```

说明：

- 是否落库待确认。
- 若不落库，可由 latest category reviews 和 latest requests 推导。

## 6. 数据迁移注意事项

### 6.1 兼容现有数据

- 新增表不应影响现有申请主流程。
- 现有 `ApplicationStatus=SUBMITTED` 的申请，在未创建 review run 前，补件状态应显示 `NOT_STARTED`。
- 现有材料文件不迁移到补件文件表。
- 补件文件不写入 `ApplicationMaterial`。

### 6.2 首轮审查幂等

迁移上线后，首次访问 `/apply/submission-complete` 时可能为已提交申请创建首轮审查。

需要保证：

- 同一申请不会重复创建多个首轮 `runNo=1`。
- 建议使用 `applicationId, runNo` 唯一约束。
- `POST initial review` 接口必须幂等。

### 6.3 Latest 标记维护

写入新一轮类别审查结果时，需要在事务中：

1. 将同申请同类别旧 `MaterialCategoryReview.isLatest` 置为 false。
2. 创建新 `MaterialCategoryReview`，`isLatest=true`。
3. 将旧 `SupplementRequest.isLatest` 置为 false 或状态改为 `HISTORY_ONLY`。
4. 创建新一轮 `SupplementRequest`。

### 6.4 审查轮次

- 默认每申请最多 3 轮补件审查。
- `runNo` 计算需要在事务内完成，避免并发重复。
- 如果外部后端自己控制队列和并发，当前项目仍需防止同申请同类别重复创建本地 run。

### 6.5 去重策略

- 同一 application、category、fileName、fileSize 视为重复。
- 如果数据库支持部分唯一索引，可只对 `isDeleted=false` 的文件施加唯一约束。
- 如果数据库不支持部分唯一索引，需要在业务层处理。

### 6.6 JSON 字段

- `resultPayload`、`suggestedMaterials`、`rawResultPayload` 等字段依赖数据库 JSON 支持。
- 若数据库不支持 JSON 类型，使用 Text 存储 JSON 字符串【待确认】。

### 6.7 回滚注意

- 新增表可独立回滚，不应破坏现有申请流程。
- 若已产生补件审查数据，回滚前需确认是否保留数据快照。

## 7. 待确认问题

1. 数据库类型是什么？
2. ORM 是什么？
3. 字段命名最终使用 camelCase 还是 snake_case？
4. 是否扩展 `Application` 增加 `materialSupplementStatus` 和 `latestMaterialReviewRunId`？
5. 是否新增 `SupplementReviewSyncLog`，还是复用 `ApplicationEventLog`？
6. 外部 AI 审查服务返回的最终 `resultPayload` 结构是什么？
7. 是否保存 AI raw output？
8. 是否保存文件解析后的文本内容？
9. `externalRunId` 是否全局唯一？
10. 补件需求是否必须绑定具体 `SupplementRequest`，还是只按类别上传即可？
11. 同一类别多个补件需求时，一个补件文件是否默认关联该类别所有待补件需求？
12. 新一轮审查原因变化时，是创建新 `SupplementRequest`，还是更新旧 request 并保留版本？
13. 是否需要 `sourceRequestId` 追踪补件需求版本链？
14. `SupplementFile` 是否需要 `fileHash` 字段？
15. 同名同大小文件去重是否允许用户强制重新上传？
16. 文件删除是否必须保留 `deletedAt` 审计时间？
17. 是否需要记录上传批次取消原因？
18. 每个申请默认 3 轮审查是否需要落库配置，还是环境变量控制？
19. 审查结果缓存命中时是否仍创建新的 `MaterialReviewRun` 历史记录？
20. 是否需要为补件页面访问、历史查看、按钮点击记录单独事件类型？
