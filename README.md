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
