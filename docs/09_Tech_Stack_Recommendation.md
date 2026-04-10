# 09 Tech Stack Recommendation

## 1. 选型结论

基于当前项目范围、交互流程、已有简历分析能力复用方式和部署现实，推荐采用以下技术栈。

## 2. 核心技术栈

### 2.1 前端与 BFF

- Framework: `Next.js App Router`
- Language: `TypeScript`
- UI Styling: `Tailwind CSS`
- UI Components: `shadcn/ui`
- Form: `React Hook Form`
- Validation: `Zod`

推荐原因：

- 适合专家端多步骤流程页
- 同时具备前端页面与服务端接口能力
- 便于实现上传、状态轮询、服务端鉴权和个性化页面恢复

### 2.2 包管理器与运行时

- Package Manager: `bun`
- Node.js Runtime: `Node.js 24 LTS`
- Package Manager Lockfile: `bun.lock`

推荐原因：

- `bun` 安装速度快，脚本执行快，适合新项目快速迭代
- 作为 2026 年 4 月 10 日的建议版本，`Node.js 24` 为 `Active LTS`，比 `Node.js 22` 更适合作为新项目默认生产版本
- `Next.js` 官方安装流程支持 `bun`

版本建议：

- `node`: `24.x`
- `bun`: `1.3.x`

### 2.3 数据与存储

- Database: `PostgreSQL`
- ORM: `Prisma`
- Object Storage: `Alibaba Cloud OSS`

推荐原因：

- `PostgreSQL` 适合状态机、审计日志、JSON 字段、事务更新
- `Prisma` 与 `Next.js + TypeScript` 组合成熟，迁移和类型约束体验好
- 当前文件上传量和材料类型适合对象存储
- 既然优先考虑阿里云，`OSS` 是最自然的对象存储选择

### 2.4 文件上传方案

- Upload Strategy: `OSS Presigned URL` 直传
- Upload Metadata API: 由 `Next.js Route Handlers` 维护

推荐原因：

- 避免大文件经过 Next.js 服务器中转
- 提升上传稳定性，降低服务端压力
- 更适合单文件 20MB、压缩包 100MB 的上传场景

### 2.5 服务端接口与流程编排

- API Layer: `Next.js Route Handlers`
- Async Resume Analysis: 调用现有异步简历分析服务
- Polling Strategy: 前端轮询分析状态接口

推荐原因：

- 当前流程有明确 API 边界，不建议把核心业务全塞进 `Server Actions`
- 已有简历处理项目已经是异步任务模式，优先直接复用
- 先用轮询实现简单稳定，后续若需要可演进为回调或消息推送

### 2.6 认证与会话

- Entry Auth: `invite token`
- Session: `HttpOnly cookie`
- Authorization: `token/application` 归属校验

推荐原因：

- 专家端是受邀访问流程，不是标准账号密码系统
- 首次访问用 token 换取短期 session，可减少后续每次请求显式携带 token 的风险
- 允许多设备打开，但每个设备都必须从有效 token 建立合法会话

### 2.7 质量保障与工程化

- Linter: `ESLint`
- Formatter: `Prettier`
- Git Hooks: `Husky`
- Staged Checks: `lint-staged`
- Unit Test: `Vitest`
- E2E Test: `Playwright`

推荐原因：

- `ESLint + Prettier` 是当前 Next.js/TS 项目中最常见且易协作的组合
- `Vitest` 启动快，适合工具函数、状态流转、校验逻辑测试
- `Playwright` 适合覆盖“上传-分析-补填-提交-恢复进度”这类端到端流程

### 2.8 可观测性

- Error Tracking: `Sentry`
- Application Logging: 结构化日志
- Audit Trail: 数据库内 `application_event_log`

推荐原因：

- 当前项目对“状态恢复失败”“分析服务异常”“上传失败”敏感
- 必须有错误追踪和审计链路

## 3. 推荐依赖清单

### 3.1 生产依赖

- `next`
- `react`
- `react-dom`
- `zod`
- `react-hook-form`
- `@hookform/resolvers`
- `@prisma/client`
- `@aws-sdk/client-s3`
- `@aws-sdk/s3-request-presigner`
- `@sentry/nextjs`
- `clsx`
- `tailwind-merge`
- `lucide-react`

说明：

- 阿里云 OSS 可通过兼容 S3 API 的抽象方式接入，或后续替换为 OSS 原生 SDK
- 如果后续确定直接使用 OSS 官方 SDK，也可替换为阿里云对应上传签名方案

### 3.2 开发依赖

- `typescript`
- `prisma`
- `eslint`
- `eslint-config-next`
- `prettier`
- `prettier-plugin-tailwindcss`
- `tailwindcss`
- `postcss`
- `husky`
- `lint-staged`
- `vitest`
- `@vitest/coverage-v8`
- `playwright`

## 4. 包管理与脚本规范

建议脚本：

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier . --write",
    "format:check": "prettier . --check",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "db:generate": "bunx --bun prisma generate",
    "db:migrate": "bunx --bun prisma migrate dev",
    "db:deploy": "bunx --bun prisma migrate deploy"
  }
}
```

## 5. 关键技术细节已确认项

- `token` 格式：由一段字符串生成的 hash 加密字符串
- `token` 有效期：动态配置
- `token` 是否一次性：否
- `token` 多设备访问：允许
- 简历分析：复用现有异步任务模式
- 文件格式：
  - 压缩包
  - PDF
  - Word
- 文件大小限制：
  - 单文件 20MB
  - 压缩包 100MB
- 提交接口：必须幂等

## 6. 当前不推荐的选项

- 不推荐当前就接入重型登录系统
- 不推荐让 Next.js 中转所有文件上传
- 不推荐先上消息队列再做第一版流程
- 不推荐将缺失字段写死在前端

## 7. 初始化建议

建议以单应用仓库启动，而不是一开始做 monorepo。

推荐初始化参数：

- `Next.js App Router`
- `TypeScript`
- `Tailwind CSS`
- `ESLint`
- `src/` 目录结构
- `@/*` 路径别名
- `bun`

## 8. 版本策略

- `Next.js`：建议使用当前稳定主线版本并锁定小版本
- `Node.js`：生产环境统一 `24.x`
- `bun`：团队统一主版本，避免锁文件抖动
- 重大升级必须先在预发布环境验证上传、状态恢复与分析集成链路
