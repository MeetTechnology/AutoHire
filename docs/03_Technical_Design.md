# 03 Technical Design

## 1. 总体架构

系统建议拆分为 4 个核心模块：

- `Expert Web App`
  - 专家端页面与交互
- `Application API`
  - 申请状态、文件管理、流程编排
- `Resume Analysis Adapter`
  - 适配既有简历分析服务
- `File Storage`
  - 简历与证明材料存储

## 2. 关键设计原则

- 身份识别以 `token` 为入口
- 申请流程以状态机驱动
- 简历分析必须异步化
- 缺失字段必须结构化返回
- 页面恢复以服务端快照为准

## 3. 核心状态机

### 3.1 状态定义

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

### 3.2 状态流转

- `INIT -> INTRO_VIEWED`
- `INTRO_VIEWED -> CV_UPLOADED`
- `CV_UPLOADED -> CV_ANALYZING`
- `CV_ANALYZING -> INELIGIBLE`
- `CV_ANALYZING -> INFO_REQUIRED`
- `CV_ANALYZING -> ELIGIBLE`
- `INFO_REQUIRED -> REANALYZING`
- `REANALYZING -> INELIGIBLE`
- `REANALYZING -> INFO_REQUIRED`
- `REANALYZING -> ELIGIBLE`
- `ELIGIBLE -> MATERIALS_IN_PROGRESS`
- `MATERIALS_IN_PROGRESS -> SUBMITTED`

## 4. 页面恢复策略

- 打开链接时通过 `token` 查询申请快照
- 一个 `token / invitation` 只恢复同一条 `application`
- 后端返回：
  - 当前状态
  - 已上传简历
  - 最新分析状态
  - 缺失字段
  - 已上传材料摘要
- 前端依据状态直接跳转对应页面

## 5. 简历分析复用方式

### 5.1 复用边界

本项目不重写简历分析逻辑，只做流程编排与结果消费。

### 5.2 适配方式

通过 `Resume Analysis Adapter` 统一调用已有能力：

- 创建分析任务
- 查询任务状态
- 获取分析结果
- 提交补充字段后二次分析

### 5.3 标准返回结构

分析结果至少包含：

- `eligibility_result`
- `reason_text`
- `display_summary`
- `extracted_fields`
- `missing_fields`

## 6. 缺失字段动态渲染

`missing_fields` 每项建议包含：

- `field_key`
- `label`
- `type`
- `required`
- `help_text`
- `options`
- `default_value`

支持字段类型：

- `text`
- `textarea`
- `number`
- `date`
- `select`
- `radio`

## 7. 文件上传设计

- 简历与材料分开管理
- 简历需按版本持久化
- 材料按分类存储
- 上传后立即记录元数据
- 前端仅持有受控文件标识，不直接持有底层存储地址
- 材料删除采用软删除，保留删除审计时间

## 8. 异步任务设计

- 上传简历后创建分析任务
- 分析任务应绑定触发它的简历版本
- 前端轮询任务状态
- 分析完成后拉取结果
- 二次分析复用同一机制

建议状态：

- `queued`
- `processing`
- `completed`
- `failed`

## 9. 安全设计

- `token` 必须为高熵随机串
- 所有专家侧接口都校验 `token` 与申请归属关系
- 文件下载使用受控访问
- 提交接口需幂等

## 10. 可观测性

建议记录如下事件：

- 链接访问
- 申请创建
- 简历上传
- 分析开始
- 分析完成
- 信息补填提交
- 材料上传
- 最终提交
- 错误与重试
