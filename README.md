# AutoHire Vibe Coding Docs

本目录包含基于当前需求整理的 Vibe Coding 文档包，供产品梳理、技术设计、AI 编码代理执行与后续联调使用。

文档顺序建议：

1. `docs/01_Research_Report.md`
2. `docs/02_PRD.md`
3. `docs/03_Technical_Design.md`
4. `docs/04_API_Contracts.md`
5. `docs/05_Data_Model.md`
6. `docs/06_Implementation_Plan.md`
7. `docs/07_Test_Plan.md`
8. `docs/08_Risks_Open_Questions.md`
9. `docs/09_Tech_Stack_Recommendation.md`
10. `docs/10_System_Architecture.md`
11. `AGENTS.md`

建议使用方式：

- 产品阶段：先确认 `02_PRD` 与 `08_Risks_Open_Questions`
- 技术方案阶段：确认 `03_Technical_Design`、`04_API_Contracts`、`05_Data_Model`、`09_Tech_Stack_Recommendation`、`10_System_Architecture`
- AI 编码阶段：把 `AGENTS.md` 与当前要做的切片任务一起喂给编码代理
- 开发执行阶段：按 `06_Implementation_Plan` 的纵向切片逐步实现
- 提测阶段：按 `07_Test_Plan` 做验证

当前已完成的实现能力：

- 邀约 token 校验与 HttpOnly 会话恢复
- 基于状态快照的 `/apply`、`/apply/resume`、`/apply/result`、`/apply/materials` 流程页
- 简历分析适配层，支持 `live` 与 `mock`
- 简历与材料的两步式 upload intent + confirm
- 本地内存运行模式与 Prisma seed 样例
- Playwright 端到端流程测试
- 真实 PostgreSQL migration / seed / 关键流程落库验证
- 阿里云 OSS 预签名上传服务端联调验证

当前进度说明：

- 当前代码库已经完成 MVP 主流程实现，包含身份识别、进度恢复、简历分析三态、结构化补填、材料上传、提交幂等
- 本地开发环境下可通过 `mock` 分析服务与内存数据模式直接联调主路径
- 真实 PostgreSQL 已完成建库、migration、seed 与关键链路验证
- 阿里云 OSS 已完成 upload intent、预签名 `PUT` 上传与材料回显的服务端联调验证
- 浏览器端直传回归、受控下载接口、真实简历分析服务 `live` 模式仍待继续收口
- 当前文档中的实施计划、测试计划、风险清单已同步更新为“已形成联调里程碑 + 待收口项”的状态

本地运行建议：

- `bun run dev`
- `bun run test`
- `bun run test:e2e`
- `bun run build`
- 若已配置 PostgreSQL：`bun run db:seed`

本地示例 token：

- `sample-init-token`
- `sample-progress-token`
- `sample-submitted-token`
