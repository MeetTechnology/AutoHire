# AGENTS.md

## Project

- Project name: `AutoHire`
- Feature in scope: 专家邀约链接打开后的专家端申请流程
- Out of scope: 邮件发送系统、邀约名单管理、后台审核工作台、多语言、消息通知系统

## Product Intent

本项目用于承接全球专家通过邮件链接进入的申报流程。专家进入后浏览 GESF/全球引才项目介绍，上传简历，系统调用既有简历分析能力进行资格初判，并根据结果引导专家补充结构化字段或继续上传证明材料，最终完成提交。

## Non-Negotiable Rules

- 必须使用邮件中的唯一 `token` 识别专家身份
- 专家关闭页面后再次进入，必须以后端持久化状态恢复进度
- 简历分析能力必须复用既有系统，不得在本项目内重写核心解析逻辑
- 资格判断逻辑来源为“大模型 + 固定提示词规则”
- 信息不足时必须返回结构化缺失字段，由前端动态渲染补填表单
- 材料上传页包含 6 个分类：
  - 身份证明
  - 工作证明
  - 学历证明
  - 荣誉证明
  - 专利证明
  - 项目证明
- 各材料分类支持批量上传，允许留空
- 最终提交后页面提示：`已收到材料信息，将在 1-3 个工作日内答复。`

## Architecture Constraints

- 采用前后端分离架构
- 简历分析走异步任务模式
- 申请状态机必须作为流程驱动核心
- 前端不得将申请进度仅保存在浏览器本地
- 文件访问必须为受控访问，不直接暴露底层存储地址

## Core States

- `INIT`
- `INTRO_VIEWED`
- `CV_UPLOADED`
- `CV_ANALYZING`
- `INFO_REQUIRED`
- `REANALYZING`
- `INELIGIBLE`
- `ELIGIBLE`
- `MATERIALS_IN_PROGRESS`
- `SUBMITTED`
- `CLOSED`

## Coding Guidance For AI Agents

- 先读 `docs/02_PRD.md`、`docs/03_Technical_Design.md`、`docs/06_Implementation_Plan.md`
- 只实现当前切片相关范围，避免跨模块大改
- 每次改动前先确认影响的状态流转和接口契约
- 优先做最小可运行 MVP，不提前做多语言、复杂权限后台、统计报表
- 如果新增字段、状态、接口，先同步更新相应文档
- 任何流程变化都必须保持“可恢复进度”能力

## Definition Of Done

- 对应功能符合 `docs/02_PRD.md` 中的验收标准
- 接口符合 `docs/04_API_Contracts.md`
- 数据落库符合 `docs/05_Data_Model.md`
- 状态流转符合 `docs/03_Technical_Design.md`
- 至少补齐对应 `docs/07_Test_Plan.md` 中的核心测试项
