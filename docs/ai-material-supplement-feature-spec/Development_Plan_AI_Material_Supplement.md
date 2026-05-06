# Development Plan

## 阶段 0：项目准备

目标：确认仍会阻塞实现的决策，建立开发边界，不写业务代码。

可验证结果：

- 待确认项被归档为“本期默认值”或“继续待确认但不阻塞”的清单。
- 任务执行顺序清楚。
- 不影响现有 `/apply/materials` 主流程。

任务：

- Task 0.1：确认本期实现决策与默认值
- Task 0.2：建立补件功能开发检查清单

## 阶段 1：基础架构

目标：先建立补件功能的类型、常量、错误码、客户端和服务骨架，不接真实业务。

可验证结果：

- 项目能编译。
- 补件模块有清晰的类型边界。
- 后续任务能基于统一类型开发。

任务：

- Task 1.1：新增补件功能类型与常量
- Task 1.2：新增补件错误码与响应模型
- Task 1.3：新增前端补件 client 骨架
- Task 1.4：新增后端 material review client 骨架

## 阶段 2：数据库与数据模型

目标：落地补件审查相关数据表、数据访问层和测试数据能力。

可验证结果：

- Prisma schema 或等价 ORM schema 包含新增模型。
- 数据访问层可以创建、查询、更新 review run、category review、request、batch、file。
- 内存模式与 Prisma 模式行为一致，若当前项目仍保留 memory mode。

任务：

- Task 2.1：新增数据库 schema 与 migration
- Task 2.2：扩展数据访问层
- Task 2.3：新增补件数据构造与样例数据
- Task 2.4：补件状态推导与 latest 维护逻辑

## 阶段 3：核心 API

目标：实现专家端和内部同步接口，先用 mock AI 审查后端返回数据，保证 API 合约闭环。

可验证结果：

- 所有 API Spec 中的专家端接口可调用。
- 所有接口校验 session、application 归属、`SUBMITTED` 状态。
- 首轮审查创建幂等。
- 补件上传批次确认后仅锁定对应类别。

任务：

- Task 3.1：实现补件访问控制与 service 骨架
- Task 3.2：实现摘要与首轮审查 API
- Task 3.3：实现补件快照与历史 API
- Task 3.4：实现补件上传批次与上传凭证 API
- Task 3.5：实现补件文件确认、删除和批次确认 API
- Task 3.6：实现审查运行状态与同步 API
- Task 3.7：实现内部回调 API

## 阶段 4：核心页面

目标：把提交完成页、补件页、历史页接入 API，完成专家端可用闭环。

可验证结果：

- 提交完成页能展示补件审查摘要并进入补件页。
- 补件页展示 6 个类别、latest 请求、上传入口和类别锁定状态。
- 历史页可查看旧需求和已满足需求。
- 移动端布局可用。

任务：

- Task 4.1：提交完成页接入补件摘要与首轮触发
- Task 4.2：新增 `/apply/supplement` 页面
- Task 4.3：实现补件文件选择、去重和批次确认交互
- Task 4.4：新增 `/apply/supplement/history` 页面
- Task 4.5：补齐访问失效和无权限状态

## 阶段 5：AI 能力接入

目标：将 mock 审查替换为可配置外部 AI 审查后端客户端，同时保留本地 mock 测试能力。

可验证结果：

- 配置 mock 模式时，开发环境可完整跑通。
- 配置 live 模式时，当前项目能创建外部审查任务并同步或接收结果。
- 外部返回结果通过 adapter 入库，不直接耦合页面。

任务：

- Task 5.1：实现 material review mock client
- Task 5.2：实现 material review live client
- Task 5.3：实现审查结果 adapter 与入库事务
- Task 5.4：实现轮询或回调同步策略

## 阶段 6：测试与修复

目标：覆盖核心业务规则、API 权限、页面流程和回归风险。

可验证结果：

- 单元测试覆盖状态推导、latest 维护、去重、轮次限制。
- 路由测试覆盖权限、状态、错误码。
- E2E 覆盖提交后首轮审查、补件上传、类别锁定、历史查看。
- 现有主流程测试不回退。

任务：

- Task 6.1：补件数据与 service 单元测试
- Task 6.2：补件 API route tests
- Task 6.3：补件页面组件与交互测试
- Task 6.4：补件 E2E 流程测试
- Task 6.5：现有材料提交流程回归修复

## 阶段 7：上线准备

目标：补齐环境变量、迁移说明、回滚方案和上线检查。

可验证结果：

- 环境变量文档完整。
- migration 可执行。
- build/test/lint 通过。
- 有明确回滚策略。

任务：

- Task 7.1：补齐环境变量与部署文档
- Task 7.2：上线前数据迁移与回滚检查
- Task 7.3：最终 QA 清单与发布记录

# AI Task Cards

## Task 0.1：确认本期实现决策与默认值

- 任务目标：
  - 将规格文档中的待确认项整理成开发前决策清单，标出哪些阻塞实现、哪些可用默认值推进。
- 背景上下文：
  - 当前已有 Lean PRD、Page Spec、Light RFC、Database Schema Spec、API Spec。
  - 用户已明确：提交后审查、补件独立页面、补件文件独立、只审查 6 类、默认 3 轮、单类别单次 10 文件。
- 涉及文件：
  - `docs/ai-material-supplement-feature-spec/Lean_PRD_AI_Material_Supplement.md`
  - `docs/ai-material-supplement-feature-spec/Page_Spec_AI_Material_Supplement.md`
  - `docs/ai-material-supplement-feature-spec/Light_RFC_AI_Material_Supplement.md`
  - `docs/ai-material-supplement-feature-spec/Database_Schema_Spec_AI_Material_Supplement.md`
  - `docs/ai-material-supplement-feature-spec/API_Spec_AI_Material_Supplement.md`
- 可能需要新增的文件：
  - `docs/ai-material-supplement-feature-spec/Implementation_Decisions.md`
- 不允许修改的内容：
  - 不修改现有业务代码。
  - 不修改已生成的规格文档原文，除非用户要求。
- 具体实现要求：
  - 列出 P0 决策：文件类型、文件大小、外部后端同步方式、回调鉴权、resultPayload 结构、补件页面路径。
  - 为非 P0 项给出建议默认值，明确“可先实现 mock/占位”。
  - 明确本期不做：邮件、人工复核、账号、多语言、Product/Paper/Book/Conference 审查。
- 边界情况：
  - 如果某项无法决策，不要自行写死，标记【待确认】。
- 验收标准：
  - 生成决策清单文档。
  - 每个待确认项都有状态：已确认、建议默认、阻塞。
- 测试要求：
  - 文档检查即可。
- 验证命令：
  - `Get-Content docs\ai-material-supplement-feature-spec\Implementation_Decisions.md`

## Task 0.2：建立补件功能开发检查清单

- 任务目标：
  - 生成一个可执行 checklist，用于开发和验收时追踪任务完成情况。
- 背景上下文：
  - 本功能拆分为数据库、API、页面、AI 接入、测试、上线准备。
- 涉及文件：
  - `docs/ai-material-supplement-feature-spec/Development_Plan_AI_Material_Supplement.md`
- 可能需要新增的文件：
  - `docs/ai-material-supplement-feature-spec/Implementation_Checklist.md`
- 不允许修改的内容：
  - 不修改代码。
- 具体实现要求：
  - 按阶段列 checkbox。
  - 每个 checkbox 对应一个可验证结果。
  - 包含“不破坏现有材料提交流程”的回归项。
- 边界情况：
  - 不把未来阶段邮件、人工复核纳入本期必做。
- 验收标准：
  - checklist 可直接用于 PR 验收。
- 测试要求：
  - 文档检查即可。
- 验证命令：
  - `Get-Content docs\ai-material-supplement-feature-spec\Implementation_Checklist.md`

## Task 1.1：新增补件功能类型与常量

- 任务目标：
  - 建立前后端共享的补件类别、状态和基础类型。
- 背景上下文：
  - 补件功能只支持 6 个审查类别。
  - 原材料类别中 Product/Paper/Book/Conference 不参与本期审查。
- 涉及文件：
  - `src/features/application/types.ts`
  - `src/features/application/constants.ts`
  - `src/lib/validation/upload.ts`
- 可能需要新增的文件：
  - `src/features/material-supplement/types.ts`
  - `src/features/material-supplement/constants.ts`
  - `src/lib/material-supplement/types.ts`
- 不允许修改的内容：
  - 不改现有 `MaterialCategory` 的含义。
  - 不改变 `/apply/materials` 现有材料分类展示。
  - 不删除现有 application 状态。
- 具体实现要求：
  - 定义 `SupplementCategory`：`IDENTITY`、`EDUCATION`、`EMPLOYMENT`、`PROJECT`、`PATENT`、`HONOR`。
  - 定义 `MaterialReviewRunStatus`、`MaterialCategoryReviewStatus`、`SupplementRequestStatus`、`SupplementUploadBatchStatus`。
  - 定义 `SupplementSnapshot`、`SupplementCategorySnapshot`、`SupplementRequestSummary`、`SupplementFileSummary`、`SupplementHistoryItem`。
  - 提供类别 label 映射。
- 边界情况：
  - 任何非 6 类类别都应能被类型或 runtime guard 拒绝。
- 验收标准：
  - 类型导出后可被 client、API、页面复用。
  - TypeScript 编译通过。
- 测试要求：
  - 可新增纯函数测试，校验 supported category guard。
- 验证命令：
  - `bun run test`
  - `bun run lint`

## Task 1.2：新增补件错误码与响应模型

- 任务目标：
  - 统一补件 API 错误码和错误响应结构。
- 背景上下文：
  - API Spec 定义了 `SUPPLEMENT_CATEGORY_REVIEWING`、`SUPPLEMENT_FILE_COUNT_EXCEEDED` 等错误码。
- 涉及文件：
  - `src/lib/http.ts`
  - `src/features/application/schemas.ts`
  - `src/app/api/**/route.ts` 只读参考
- 可能需要新增的文件：
  - `src/lib/material-supplement/errors.ts`
  - `src/lib/material-supplement/schemas.ts`
- 不允许修改的内容：
  - 不改变现有 API 错误响应格式，除非补件模块内部适配。
  - 不改现有 route 的错误码语义。
- 具体实现要求：
  - 定义补件错误码常量。
  - 定义 service error class 或复用现有错误模型。
  - 定义 zod schema 用于补件 API 请求校验。
- 边界情况：
  - 内部回调错误码与专家端错误码区分。
- 验收标准：
  - 后续 route 可统一抛出/返回补件错误。
- 测试要求：
  - 单元测试校验错误响应 shape。
- 验证命令：
  - `bun run test`
  - `bun run lint`

## Task 1.3：新增前端补件 client 骨架

- 任务目标：
  - 提供前端页面调用补件 API 的 client 方法。
- 背景上下文：
  - Page Spec 需要提交完成页、补件页、历史页调用补件 API。
- 涉及文件：
  - `src/features/application/client.ts`
- 可能需要新增的文件：
  - `src/features/material-supplement/client.ts`
- 不允许修改的内容：
  - 不破坏现有 application client 方法。
- 具体实现要求：
  - 新增函数：`fetchSupplementSummary`、`ensureInitialReview`、`fetchSupplementSnapshot`、`fetchSupplementHistory`、`createSupplementUploadBatch`、`createSupplementUploadIntent`、`confirmSupplementFileUpload`、`deleteSupplementDraftFile`、`confirmSupplementUploadBatch`。
  - 统一处理 HTTP 错误。
  - 先按 API Spec 定义返回类型，不实现 UI。
- 边界情况：
  - 401/403 应抛出可被页面识别的错误。
- 验收标准：
  - client 方法可被页面导入。
  - 不影响现有 client。
- 测试要求：
  - 可用 fetch mock 测试错误处理。
- 验证命令：
  - `bun run test`
  - `bun run lint`

## Task 1.4：新增后端 material review client 骨架

- 任务目标：
  - 为外部 AI 审查后端接入预留客户端接口，并提供 mock 实现。
- 背景上下文：
  - 当前 Next.js Route Handler 不直接跑 AI 审查。
  - 外部接口协议未完全确认，因此本期先 adapter 化。
- 涉及文件：
  - `src/lib/env.ts`
  - `src/lib/resume-analysis/client.ts` 只读参考
- 可能需要新增的文件：
  - `src/lib/material-review/client.ts`
  - `src/lib/material-review/types.ts`
  - `src/lib/material-review/mock.ts`
- 不允许修改的内容：
  - 不改现有 resume analysis client 行为。
- 具体实现要求：
  - 定义 `createInitialMaterialReview`、`createCategoryMaterialReview`、`getMaterialReviewResult`。
  - 支持 mock mode 和 live mode 占位。
  - env 增加可选配置：`MATERIAL_REVIEW_BASE_URL`、`MATERIAL_REVIEW_API_KEY`、`MATERIAL_REVIEW_MODE`。
- 边界情况：
  - live 未配置时应返回明确配置错误。
- 验收标准：
  - mock client 可返回固定 run/result。
  - env schema 校验通过。
- 测试要求：
  - 单元测试 mock client 输出。
- 验证命令：
  - `bun run test`
  - `bun run lint`

## Task 2.1：新增数据库 schema 与 migration

- 任务目标：
  - 在 ORM schema 中新增补件相关表和枚举。
- 背景上下文：
  - Database Schema Spec 建议新增 5 张核心表，可选 sync log。
- 涉及文件：
  - `prisma/schema.prisma`
- 可能需要新增的文件：
  - `prisma/migrations/*`
- 不允许修改的内容：
  - 不删除现有表字段。
  - 不修改现有 enum 值语义。
  - 不把补件文件写入 `ApplicationMaterial`。
- 具体实现要求：
  - 新增枚举：review run status、trigger type、category review status、supplement request status、upload batch status、supplement category。
  - 新增模型：`MaterialReviewRun`、`MaterialCategoryReview`、`SupplementRequest`、`SupplementUploadBatch`、`SupplementFile`。
  - 是否新增 `SupplementReviewSyncLog` 按实现决策。
  - 添加外键、索引、唯一约束。
- 边界情况：
  - `externalRunId` 唯一性若未确认，可先加普通索引而非唯一约束。
  - 部分唯一索引如果 Prisma/数据库不支持，交由业务层去重。
- 验收标准：
  - `prisma generate` 成功。
  - migration 可在本地数据库应用。
- 测试要求：
  - 运行现有 Prisma 相关测试。
- 验证命令：
  - `bun run db:generate`
  - `bun run test`

## Task 2.2：扩展数据访问层

- 任务目标：
  - 为补件功能增加数据库读写方法。
- 背景上下文：
  - 当前项目可能同时支持 Prisma 和 memory store。
- 涉及文件：
  - `src/lib/data/store.ts`
  - `src/lib/db/prisma.ts`
  - `src/lib/data/sample-data.ts`
- 可能需要新增的文件：
  - `src/lib/material-supplement/store.ts`
- 不允许修改的内容：
  - 不破坏现有 store 方法签名。
  - 不移除 memory mode。
- 具体实现要求：
  - 实现创建/查询 latest review run。
  - 实现创建 category review 并维护 `isLatest`。
  - 实现创建/历史化 supplement request。
  - 实现 upload batch 和 supplement file CRUD。
  - 实现 snapshot/history 查询组合。
- 边界情况：
  - 同一 application + runNo 幂等。
  - 同一类别 latest 更新需要事务。
  - 草稿文件删除只允许未确认批次。
- 验收标准：
  - Prisma 和 memory mode 均可通过基础测试。
- 测试要求：
  - 新增 store 单元测试。
- 验证命令：
  - `bun run test`

## Task 2.3：新增补件数据构造与样例数据

- 任务目标：
  - 为测试和本地开发提供补件样例。
- 背景上下文：
  - 页面和 API 需要有待补件、审查中、已满足、历史等状态样例。
- 涉及文件：
  - `src/lib/data/sample-data.ts`
  - `prisma/seed.ts`
- 可能需要新增的文件：
  - `src/lib/material-supplement/fixtures.ts`
- 不允许修改的内容：
  - 不改变现有 sample token 的主流程含义。
- 具体实现要求：
  - 增加至少 3 种样例：审查中、需要补件、全部满足。
  - 样例申请必须为 `SUBMITTED`。
  - 保留原有 sample token 可用。
- 边界情况：
  - 未提交申请不应出现补件数据。
- 验收标准：
  - 本地可用样例查看补件页面。
- 测试要求：
  - sample data 构造测试或 snapshot 测试。
- 验证命令：
  - `bun run test`
  - `bun run db:seed`

## Task 2.4：补件状态推导与 latest 维护逻辑

- 任务目标：
  - 实现申请级、类别级和 request 级状态推导。
- 背景上下文：
  - RFC 建议补件状态优先由 latest run/category/request 推导。
- 涉及文件：
  - `src/features/material-supplement/types.ts`
  - `src/lib/material-supplement/service.ts`
- 可能需要新增的文件：
  - `src/lib/material-supplement/status.ts`
  - `src/lib/material-supplement/status.test.ts`
- 不允许修改的内容：
  - 不新增主 `ApplicationStatus`，除非用户确认。
- 具体实现要求：
  - 推导 `NOT_STARTED`、`REVIEWING`、`SUPPLEMENT_REQUIRED`、`NO_SUPPLEMENT_REQUIRED`、`PARTIALLY_SATISFIED`、`SATISFIED`。
  - 推导类别 `isReviewing`。
  - 计算剩余轮次。
  - 隐藏已满足 latest request，但 history 可查。
- 边界情况：
  - 无 run。
  - run failed。
  - 类别 failed。
  - 旧 request 不应出现在 latest 列表。
- 验收标准：
  - 状态推导函数测试覆盖主要分支。
- 测试要求：
  - 单元测试。
- 验证命令：
  - `bun run test`

## Task 3.1：实现补件访问控制与 service 骨架

- 任务目标：
  - 建立补件 API 共用权限校验和 service 入口。
- 背景上下文：
  - 所有补件接口必须校验 session、application 归属和 `SUBMITTED` 状态。
- 涉及文件：
  - `src/lib/auth/session.ts`
  - `src/lib/auth/access.ts`
  - `src/lib/application/service.ts`
- 可能需要新增的文件：
  - `src/lib/material-supplement/service.ts`
  - `src/lib/material-supplement/access.ts`
- 不允许修改的内容：
  - 不放宽现有申请访问权限。
  - 不允许非 `SUBMITTED` 申请访问补件流程。
- 具体实现要求：
  - 实现 `assertSupplementAccess`。
  - 实现 `assertSupportedSupplementCategory`。
  - 实现 `assertCategoryNotReviewing`。
  - 实现 `assertReviewRoundLimit`。
- 边界情况：
  - session 失效。
  - application 不存在。
  - application 不属于 session。
  - application 未提交。
- 验收标准：
  - service 方法可被 route 复用。
- 测试要求：
  - 访问控制单元测试。
- 验证命令：
  - `bun run test`

## Task 3.2：实现摘要与首轮审查 API

- 任务目标：
  - 实现提交完成页需要的 summary 和 initial review 接口。
- 背景上下文：
  - `/apply/submission-complete` 加载时读取摘要，并确保首轮审查存在。
- 涉及文件：
  - `src/app/api/applications/[applicationId]/**`
- 可能需要新增的文件：
  - `src/app/api/applications/[applicationId]/material-supplement/summary/route.ts`
  - `src/app/api/applications/[applicationId]/material-supplement/reviews/initial/route.ts`
- 不允许修改的内容：
  - 不改变现有 submit API 行为。
- 具体实现要求：
  - `GET summary` 返回 API Spec 结构。
  - `POST initial` 幂等创建 runNo=1。
  - 创建后调用 material review client mock/live。
  - 返回 `created` 标记。
- 边界情况：
  - 首轮已存在。
  - 外部后端不可用。
  - 已提交但无材料。
- 验收标准：
  - route tests 通过。
  - 重复调用 initial 不重复创建 run。
- 测试要求：
  - 新增 route test。
- 验证命令：
  - `bun run test`

## Task 3.3：实现补件快照与历史 API

- 任务目标：
  - 实现补件页和历史页读取接口。
- 背景上下文：
  - 补件页需要 top summary + 6 类 latest 状态 + requests + files。
- 涉及文件：
  - `src/app/api/applications/[applicationId]/**`
- 可能需要新增的文件：
  - `src/app/api/applications/[applicationId]/material-supplement/route.ts`
  - `src/app/api/applications/[applicationId]/material-supplement/history/route.ts`
- 不允许修改的内容：
  - 不暴露底层 object key 或长期存储 URL。
- 具体实现要求：
  - `GET material-supplement` 返回 snapshot。
  - `GET history` 支持 `category`、`runNo` 查询。
  - 非法筛选参数按 Page Spec 回退默认。
- 边界情况：
  - 无历史。
  - 全部已满足。
  - 审查中。
  - 类别 failed。
- 验收标准：
  - 返回结构符合 API Spec。
- 测试要求：
  - route tests 覆盖筛选和权限。
- 验证命令：
  - `bun run test`

## Task 3.4：实现补件上传批次与上传凭证 API

- 任务目标：
  - 支持专家按类别创建补件上传批次并申请文件上传凭证。
- 背景上下文：
  - 补件文件独立于 `ApplicationMaterial`。
- 涉及文件：
  - `src/lib/upload/service.ts`
  - `src/lib/storage/object-store.ts`
  - `src/lib/validation/upload.ts`
- 可能需要新增的文件：
  - `src/app/api/applications/[applicationId]/material-supplement/upload-batches/route.ts`
  - `src/app/api/applications/[applicationId]/material-supplement/upload-intent/route.ts`
  - `src/lib/material-supplement/upload.ts`
- 不允许修改的内容：
  - 不改变原材料 upload intent 行为。
  - 不将补件文件保存到 `ApplicationMaterial`。
- 具体实现要求：
  - 创建 batch。
  - 创建 upload intent。
  - 校验 6 类类别、reviewing lock、轮次上限、文件数量、文件类型和大小。
  - object key 使用 supplement 独立路径。
- 边界情况：
  - 重复文件。
  - batch 不存在。
  - batch 非 draft。
  - category reviewing。
- 验收标准：
  - API 可返回 upload URL/objectKey。
- 测试要求：
  - route tests + upload validation tests。
- 验证命令：
  - `bun run test`

## Task 3.5：实现补件文件确认、删除和批次确认 API

- 任务目标：
  - 完成补件上传闭环，并在批次确认后触发类别审查。
- 背景上下文：
  - 多文件批量确认后，只触发一次对应类别审查。
- 涉及文件：
  - `src/app/api/applications/[applicationId]/**`
  - `src/lib/material-supplement/service.ts`
- 可能需要新增的文件：
  - `src/app/api/applications/[applicationId]/material-supplement/files/route.ts`
  - `src/app/api/applications/[applicationId]/material-supplement/files/[fileId]/route.ts`
  - `src/app/api/applications/[applicationId]/material-supplement/upload-batches/[batchId]/confirm/route.ts`
- 不允许修改的内容：
  - 不触发全类别重新审查。
  - 不允许审查中类别继续上传。
- 具体实现要求：
  - `POST files` 确认单个补件文件。
  - `DELETE files/{fileId}` 只删除 draft 文件。
  - `POST batch confirm` 创建 category-only run 并锁定类别。
  - 更新 batch 状态。
- 边界情况：
  - 空 batch。
  - 超过 10 文件。
  - 删除已确认文件。
  - 确认已确认 batch。
- 验收标准：
  - 批次确认后 snapshot 显示该类别 reviewing。
- 测试要求：
  - route tests 覆盖状态限制。
- 验证命令：
  - `bun run test`

## Task 3.6：实现审查运行状态与同步 API

- 任务目标：
  - 支持查询单个审查 run 状态，并从外部后端同步结果。
- 背景上下文：
  - 当前项目可能采用轮询或回调；本任务先实现可手动 sync 的接口。
- 涉及文件：
  - `src/lib/material-review/client.ts`
  - `src/lib/material-supplement/service.ts`
- 可能需要新增的文件：
  - `src/app/api/applications/[applicationId]/material-supplement/reviews/[reviewRunId]/route.ts`
  - `src/app/api/applications/[applicationId]/material-supplement/reviews/[reviewRunId]/sync/route.ts`
- 不允许修改的内容：
  - 不让旧回调覆盖新 latest。
- 具体实现要求：
  - `GET reviewRun` 返回 run 状态。
  - `POST sync` 调用 material review client 并入库。
  - 幂等处理重复 sync。
- 边界情况：
  - run 不存在。
  - 外部后端不可用。
  - 结果格式非法。
  - stale result。
- 验收标准：
  - mock result 可同步为 request。
- 测试要求：
  - service + route tests。
- 验证命令：
  - `bun run test`

## Task 3.7：实现内部回调 API

- 任务目标：
  - 支持外部 AI 审查后端回调写入结果。
- 背景上下文：
  - 若最终采用轮询，该接口也可作为后续预留；但必须安全。
- 涉及文件：
  - `src/app/api/internal/**`
  - `src/lib/material-supplement/service.ts`
- 可能需要新增的文件：
  - `src/app/api/internal/material-supplement/reviews/[reviewRunId]/callback/route.ts`
  - `src/lib/material-supplement/internal-auth.ts`
- 不允许修改的内容：
  - 不允许无鉴权写入结果。
  - 不允许内部接口使用专家 session 代替服务鉴权。
- 具体实现要求：
  - 实现 callback 请求 schema。
  - 校验内部鉴权占位或配置。
  - 校验 result payload。
  - 写入 category review 和 supplement requests。
  - 处理 duplicate/stale callback。
- 边界情况：
  - 签名错误。
  - timestamp 过期。
  - run 不存在。
  - duplicate callback。
- 验收标准：
  - route tests 覆盖成功、重复、无鉴权。
- 测试要求：
  - route tests。
- 验证命令：
  - `bun run test`

## Task 4.1：提交完成页接入补件摘要与首轮触发

- 任务目标：
  - 在 `/apply/submission-complete` 展示 AI 材料审查摘要和补件入口。
- 背景上下文：
  - 提交完成页是补件流程入口。
- 涉及文件：
  - `src/app/(public)/apply/submission-complete/page.tsx`
  - `src/features/application/client.ts`
- 可能需要新增的文件：
  - `src/features/material-supplement/components/supplement-summary-card.tsx`
- 不允许修改的内容：
  - 不移除现有提交成功信息。
  - 不改变提交成功路由。
- 具体实现要求：
  - 页面加载后 fetch summary。
  - 若首轮不存在，调用 ensure initial review。
  - 显示 reviewing、required、no supplement、failed 等状态。
  - 添加 `View supplement requests`。
- 边界情况：
  - summary 加载失败。
  - initial 触发失败。
  - session 失效。
- 验收标准：
  - 已提交申请能看到补件入口。
  - 审查中有清晰提示。
- 测试要求：
  - 组件测试或 E2E 覆盖。
- 验证命令：
  - `bun run test`
  - `bun run lint`

## Task 4.2：新增 `/apply/supplement` 页面

- 任务目标：
  - 实现补件主页面 UI。
- 背景上下文：
  - 该页只展示 6 类审查类别。
- 涉及文件：
  - `src/app/(public)/apply/layout.tsx`
- 可能需要新增的文件：
  - `src/app/(public)/apply/supplement/page.tsx`
  - `src/features/material-supplement/components/supplement-workspace.tsx`
  - `src/features/material-supplement/components/supplement-category-section.tsx`
  - `src/features/material-supplement/components/supplement-request-card.tsx`
- 不允许修改的内容：
  - 不把补件组件塞进 `/apply/materials`。
  - 不展示非 6 类类别。
- 具体实现要求：
  - 加载 snapshot。
  - 顶部展示待补件数量、已满足数量、剩余轮次。
  - 6 类分组展示 latest AI message 和 requests。
  - 已满足 request 默认隐藏。
  - 支持 refresh、back、history。
- 边界情况：
  - 无 run。
  - reviewing。
  - no supplement。
  - failed fallback。
  - unauthorized。
- 验收标准：
  - 补件页面可从提交完成页进入。
  - 移动端单列可用。
- 测试要求：
  - 组件测试或 E2E。
- 验证命令：
  - `bun run test`
  - `bun run lint`

## Task 4.3：实现补件文件选择、去重和批次确认交互

- 任务目标：
  - 在补件页面完成文件选择、草稿列表、删除、提交审查交互。
- 背景上下文：
  - 上传新材料后，只触发对应类别后续审查。
- 涉及文件：
  - `src/features/material-supplement/client.ts`
  - `src/features/material-supplement/components/supplement-category-section.tsx`
- 可能需要新增的文件：
  - `src/features/material-supplement/components/supplement-file-picker.tsx`
  - `src/features/material-supplement/file-validation.ts`
- 不允许修改的内容：
  - 不复用原材料列表作为补件列表。
  - 不允许审查中类别上传。
- 具体实现要求：
  - 选择文件后前端去重。
  - 限制单次 10 文件。
  - 支持删除未确认文件。
  - 批量 confirm 后调用 batch confirm。
  - 成功后刷新 snapshot。
- 边界情况：
  - 重复文件。
  - 超过 10 文件。
  - upload intent 失败。
  - PUT 失败。
  - confirm 失败。
- 验收标准：
  - 类别确认后只有该类别进入 reviewing。
- 测试要求：
  - 组件测试 + client 测试。
- 验证命令：
  - `bun run test`
  - `bun run lint`

## Task 4.4：新增 `/apply/supplement/history` 页面

- 任务目标：
  - 实现补件历史查看页面。
- 背景上下文：
  - 已满足和旧需求默认不在主页面展示，但必须可追溯。
- 涉及文件：
  - `src/app/(public)/apply/layout.tsx`
- 可能需要新增的文件：
  - `src/app/(public)/apply/supplement/history/page.tsx`
  - `src/features/material-supplement/components/supplement-history-view.tsx`
- 不允许修改的内容：
  - 不删除旧审查记录。
- 具体实现要求：
  - 支持 `category` 查询参数。
  - 默认按时间倒序。
  - 非法筛选回退全部。
  - 显示 runNo、category、reviewedAt、files、requests、aiMessage。
- 边界情况：
  - 无历史。
  - 只有已满足。
  - 非法 category。
- 验收标准：
  - 可查看已满足需求。
- 测试要求：
  - 组件测试或 E2E。
- 验证命令：
  - `bun run test`
  - `bun run lint`

## Task 4.5：补齐访问失效和无权限状态

- 任务目标：
  - 让补件页面和历史页在 session/token/权限异常时安全展示。
- 背景上下文：
  - 无权限时不能泄露申请或补件数据。
- 涉及文件：
  - `src/app/(public)/apply/supplement/page.tsx`
  - `src/app/(public)/apply/supplement/history/page.tsx`
  - `src/components/ui/page-shell.tsx`
- 可能需要新增的文件：
  - `src/features/material-supplement/components/supplement-access-error.tsx`
- 不允许修改的内容：
  - 不展示任何真实 request/file 信息给无权限用户。
- 具体实现要求：
  - 区分 loading、unauthorized、forbidden、not submitted。
  - 提供返回申请入口或提交完成页按钮。
- 边界情况：
  - session 过期。
  - application 不存在。
  - 非 submitted。
- 验收标准：
  - 无权限访问页面无数据泄露。
- 测试要求：
  - route/page 测试。
- 验证命令：
  - `bun run test`

## Task 5.1：实现 material review mock client

- 任务目标：
  - 提供开发和测试可控的 AI 审查结果。
- 背景上下文：
  - 外部 AI 审查后端接口未最终确认。
- 涉及文件：
  - `src/lib/material-review/client.ts`
- 可能需要新增的文件：
  - `src/lib/material-review/mock.ts`
  - `src/lib/material-review/fixtures.ts`
- 不允许修改的内容：
  - 不调用真实外部服务。
- 具体实现要求：
  - mock 首轮可返回：需要补件、无需补件、审查中、已满足。
  - mock 类别后续审查可把某需求转为 satisfied。
  - 支持通过 env 或测试参数选择场景。
- 边界情况：
  - 无材料类别。
  - 未提取简历信息类别。
- 验收标准：
  - E2E 可稳定跑通。
- 测试要求：
  - mock client 单元测试。
- 验证命令：
  - `bun run test`

## Task 5.2：实现 material review live client

- 任务目标：
  - 接入外部 AI 审查后端的 live 调用骨架。
- 背景上下文：
  - 外部服务负责队列、并发、AI 输出解析。
- 涉及文件：
  - `src/lib/env.ts`
  - `src/lib/material-review/client.ts`
- 可能需要新增的文件：
  - `src/lib/material-review/live.ts`
- 不允许修改的内容：
  - 不在 Next.js route 里执行长时间 AI 审查。
- 具体实现要求：
  - 从 env 读取 base URL/API key。
  - 实现创建首轮、创建类别审查、获取结果。
  - 网络错误返回可识别错误。
- 边界情况：
  - 未配置 base URL。
  - 401/403。
  - 5xx。
  - 超时。
- 验收标准：
  - 在未配置 live 时 mock 模式仍可用。
- 测试要求：
  - fetch mock 测试。
- 验证命令：
  - `bun run test`

## Task 5.3：实现审查结果 adapter 与入库事务

- 任务目标：
  - 把外部后端结果转换为本地 category review 和 supplement requests。
- 背景上下文：
  - 页面不能直接依赖外部原始输出结构。
- 涉及文件：
  - `src/lib/material-supplement/service.ts`
  - `src/lib/material-review/types.ts`
- 可能需要新增的文件：
  - `src/lib/material-supplement/result-adapter.ts`
  - `src/lib/material-supplement/result-adapter.test.ts`
- 不允许修改的内容：
  - 不丢弃历史记录。
  - 不覆盖其他类别 latest。
- 具体实现要求：
  - 校验支持类别。
  - 写入新的 category review。
  - 将旧 same category latest 置 false。
  - 创建新 requests。
  - 旧 requests 标为 history。
  - 更新 batch completed。
- 边界情况：
  - 空 requests。
  - satisfied。
  - malformed result。
  - stale run。
- 验收标准：
  - 多轮同类别审查历史完整。
- 测试要求：
  - 单元测试覆盖事务逻辑。
- 验证命令：
  - `bun run test`

## Task 5.4：实现轮询或回调同步策略

- 任务目标：
  - 决定并实现当前项目获取审查结果的策略。
- 背景上下文：
  - API Spec 同时预留 sync 和 callback。
- 涉及文件：
  - `src/app/api/applications/[applicationId]/material-supplement/reviews/[reviewRunId]/sync/route.ts`
  - `src/app/api/internal/material-supplement/reviews/[reviewRunId]/callback/route.ts`
- 可能需要新增的文件：
  - `src/lib/material-supplement/sync.ts`
- 不允许修改的内容：
  - 不允许无鉴权 internal callback。
- 具体实现要求：
  - 如果采用轮询：页面或 API 可触发 sync。
  - 如果采用回调：internal route 验证签名并入库。
  - 重复结果幂等。
- 边界情况：
  - duplicate callback。
  - stale callback。
  - sync failed。
- 验收标准：
  - mock 外部结果能同步到页面。
- 测试要求：
  - route tests。
- 验证命令：
  - `bun run test`

## Task 6.1：补件数据与 service 单元测试

- 任务目标：
  - 覆盖数据和业务规则。
- 背景上下文：
  - 补件功能状态多，必须先用单测锁住。
- 涉及文件：
  - `src/lib/material-supplement/*.ts`
  - `src/features/material-supplement/*.ts`
- 可能需要新增的文件：
  - `src/lib/material-supplement/service.test.ts`
  - `src/lib/material-supplement/status.test.ts`
- 不允许修改的内容：
  - 不放宽业务限制只为测试通过。
- 具体实现要求：
  - 测试 6 类 guard。
  - 测试轮次上限。
  - 测试 category reviewing lock。
  - 测试 latest/history。
  - 测试 duplicate file。
- 边界情况：
  - 无 run。
  - failed run。
  - all satisfied。
- 验收标准：
  - 新单测通过。
- 测试要求：
  - Vitest。
- 验证命令：
  - `bun run test`

## Task 6.2：补件 API route tests

- 任务目标：
  - 覆盖专家端接口与内部接口权限和响应。
- 背景上下文：
  - API Spec 中错误码较多，route tests 必须防回归。
- 涉及文件：
  - `src/app/api/applications/[applicationId]/material-supplement/**`
  - `src/app/api/internal/material-supplement/**`
- 可能需要新增的文件：
  - 对应 `route.test.ts`
- 不允许修改的内容：
  - 不跳过鉴权。
- 具体实现要求：
  - 测试 summary、initial、snapshot、history。
  - 测试 upload batch、intent、file confirm、delete、batch confirm。
  - 测试 sync/callback。
  - 覆盖 401/403/not submitted/unsupported category/reviewing。
- 边界情况：
  - 重复 initial。
  - 重复 callback。
  - stale sync。
- 验收标准：
  - route tests 通过。
- 测试要求：
  - Vitest route tests。
- 验证命令：
  - `bun run test`

## Task 6.3：补件页面组件与交互测试

- 任务目标：
  - 覆盖页面关键交互。
- 背景上下文：
  - 补件页需要处理 loading、empty、error、success。
- 涉及文件：
  - `src/features/material-supplement/components/**`
- 可能需要新增的文件：
  - 组件测试文件。
- 不允许修改的内容：
  - 不引入与现有 UI 风格冲突的大型新组件库。
- 具体实现要求：
  - 测试 6 类展示。
  - 测试 reviewing 禁用上传。
  - 测试去重提示。
  - 测试超过 10 文件提示。
  - 测试已满足默认隐藏。
- 边界情况：
  - 无补件需求。
  - 全部已满足。
  - 加载失败。
- 验收标准：
  - 组件测试通过。
- 测试要求：
  - 项目现有测试工具。
- 验证命令：
  - `bun run test`

## Task 6.4：补件 E2E 流程测试

- 任务目标：
  - 覆盖完整专家端补件流程。
- 背景上下文：
  - 现有项目有 Playwright E2E。
- 涉及文件：
  - `tests/e2e/**`
  - `playwright.config.ts`
- 可能需要新增的文件：
  - `tests/e2e/material-supplement.spec.ts`
- 不允许修改的内容：
  - 不改变 Playwright `workers: 1` 要求。
  - 不破坏现有 E2E。
- 具体实现要求：
  - 使用 mock AI 审查。
  - 流程：提交完成页 -> 自动首轮审查 -> 补件页 -> 上传教育补件 -> 类别 locked -> 审查完成 -> 历史可见。
  - 测试无权限或非 submitted 跳转。
- 边界情况：
  - 审查中刷新恢复。
  - 重复文件。
- 验收标准：
  - E2E 稳定通过。
- 测试要求：
  - Playwright。
- 验证命令：
  - `bun run test:e2e`

## Task 6.5：现有材料提交流程回归修复

- 任务目标：
  - 确保补件功能没有破坏现有主流程。
- 背景上下文：
  - 本功能不能改变提交前主流程。
- 涉及文件：
  - `src/app/(public)/apply/materials/page.tsx`
  - 现有测试文件
- 可能需要新增的文件：
  - 回归测试文件或补充现有测试。
- 不允许修改的内容：
  - 不改变最低材料要求。
  - 不改变原材料上传确认语义。
- 具体实现要求：
  - 跑现有单测和 E2E。
  - 修复因新增状态或类型导致的回归。
- 边界情况：
  - 已提交 review mode。
  - materials page redirect。
- 验收标准：
  - 现有流程测试通过。
- 测试要求：
  - 全量 test + e2e。
- 验证命令：
  - `bun run test`
  - `bun run test:e2e`

## Task 7.1：补齐环境变量与部署文档

- 任务目标：
  - 为上线准备配置说明。
- 背景上下文：
  - Light RFC 建议新增 material review 相关 env。
- 涉及文件：
  - `.env.example`
  - `docs/ai-material-supplement-feature-spec/Light_RFC_AI_Material_Supplement.md`
- 可能需要新增的文件：
  - `docs/ai-material-supplement-feature-spec/Deployment_Checklist.md`
- 不允许修改的内容：
  - 不提交真实密钥。
- 具体实现要求：
  - 增加 mock/live 配置说明。
  - 增加最大轮次、最大文件数、允许类型、最大文件大小说明。
  - 增加 callback secret 或 API key 说明。
- 边界情况：
  - 未配置 live 时应使用 mock 或明确失败。
- 验收标准：
  - 新成员可按文档配置本地。
- 测试要求：
  - 文档检查。
- 验证命令：
  - `Get-Content .env.example`

## Task 7.2：上线前数据迁移与回滚检查

- 任务目标：
  - 准备 migration 执行和回滚说明。
- 背景上下文：
  - 新增表应不影响现有主流程。
- 涉及文件：
  - `prisma/migrations/**`
  - `docs/ai-material-supplement-feature-spec/Database_Schema_Spec_AI_Material_Supplement.md`
- 可能需要新增的文件：
  - `docs/ai-material-supplement-feature-spec/Migration_Runbook.md`
- 不允许修改的内容：
  - 不删除已存在生产数据。
- 具体实现要求：
  - 写明迁移前检查。
  - 写明迁移后 smoke test。
  - 写明回滚策略。
- 边界情况：
  - 已提交申请尚无 review run。
- 验收标准：
  - migration runbook 完整。
- 测试要求：
  - 在本地测试 migration。
- 验证命令：
  - `bun run db:generate`
  - `bun run test`

## Task 7.3：最终 QA 清单与发布记录

- 任务目标：
  - 输出发布前最后检查清单。
- 背景上下文：
  - 单人/小团队需要清晰上线前 gate。
- 涉及文件：
  - `docs/ai-material-supplement-feature-spec/Implementation_Checklist.md`
- 可能需要新增的文件：
  - `docs/ai-material-supplement-feature-spec/Release_QA_Checklist.md`
- 不允许修改的内容：
  - 不改业务代码。
- 具体实现要求：
  - 覆盖 lint、format、unit、e2e、build。
  - 覆盖权限测试。
  - 覆盖 mock/live 配置。
  - 覆盖回滚准备。
- 边界情况：
  - 外部 AI 后端未上线时，是否允许 mock 发布【待确认】。
- 验收标准：
  - QA checklist 可作为发布 gate。
- 测试要求：
  - 文档检查。
- 验证命令：
  - `bun run lint`
  - `bun run format:check`
  - `bun run test`
  - `bun run test:e2e`
  - `bun run build`
