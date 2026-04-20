# Database Schema Change Draft

本节基于当前 `prisma/schema.prisma` 的现状整理。

## 1. 设计原则

- 新增“入口访问日志”和“上传尝试日志”独立表，不把不同职责强行塞进同一张表。
- `ApplicationEventLog` 继续作为“已进入申请流程后的事件流”，但补齐可查询字段。
- `Application` 增加里程碑时间，作为高频统计的派生真源。
- 首版优先保证可落库、可查询、可回溯，不追求一开始就做极度抽象的统一埋点模型。
- 为兼容历史数据，新增字段优先允许空值，再通过应用写入和有限回填逐步补齐。

## 2. 新增/扩展枚举

```prisma
enum AccessResult {
  VALID
  INVALID
  EXPIRED
  DISABLED
  SESSION_RESTORE
}

enum AccessTokenStatusSnapshot {
  UNKNOWN
  ACTIVE
  EXPIRED
  DISABLED
}

enum EventStatus {
  SUCCESS
  FAIL
}

enum UploadKind {
  RESUME
  MATERIAL
}

enum UploadFailureStage {
  INTENT
  PUT
  CONFIRM
}
```

说明：

- `AccessTokenStatusSnapshot` 不直接复用现有 `TokenStatus`，因为无效 token 访问并没有对应邀约记录，需要 `UNKNOWN`
- `EventStatus` 建议做成枚举，避免 `success/fail` 的大小写和口径漂移
- `UploadKind` 与 `UploadFailureStage` 用于稳定统计口径

## 3. 新增 `InviteAccessLog`

```prisma
model InviteAccessLog {
  id                String                    @id @default(cuid())
  occurredAt        DateTime                  @default(now())
  invitationId      String?
  applicationId     String?
  tokenStatus       AccessTokenStatusSnapshot @default(UNKNOWN)
  accessResult      AccessResult
  ipHash            String?
  userAgent         String?
  referer           String?
  landingPath       String?
  sessionId         String
  requestId         String
  utmSource         String?
  utmMedium         String?
  utmCampaign       String?
  createdAt         DateTime                  @default(now())

  invitation        ExpertInvitation?         @relation(fields: [invitationId], references: [id])
  application       Application?              @relation(fields: [applicationId], references: [id])

  @@index([occurredAt])
  @@index([invitationId, occurredAt])
  @@index([applicationId, occurredAt])
  @@index([accessResult, occurredAt])
  @@index([tokenStatus, occurredAt])
  @@index([sessionId, occurredAt])
  @@index([requestId])
  @@index([utmSource, utmMedium, utmCampaign])
}
```

设计说明：

- `invitationId`、`applicationId` 都允许为空，覆盖无效 token 场景
- `sessionId` 和 `requestId` 必填，用于串联会话和单次请求
- `ipHash` 建议允许空值，避免代理链或隐私策略导致主流程受阻
- `createdAt` 可保留，也可以只用 `occurredAt`

## 4. 扩展 `ApplicationEventLog`

```prisma
model ApplicationEventLog {
  id            String      @id @default(cuid())
  applicationId String
  eventType     String
  eventTime     DateTime    @default(now())
  pageName      String?
  stepName      String?
  actionName    String?
  eventStatus   EventStatus?
  errorCode     String?
  errorMessage  String?     @db.Text
  durationMs    Int?
  sessionId     String?
  requestId     String?
  ipHash        String?
  userAgent     String?
  referer       String?
  eventPayload  Json?
  createdAt     DateTime    @default(now())

  application   Application @relation(fields: [applicationId], references: [id])

  @@index([applicationId, eventTime])
  @@index([eventType, eventTime])
  @@index([pageName, eventTime])
  @@index([stepName, eventTime])
  @@index([actionName, eventTime])
  @@index([eventStatus, eventTime])
  @@index([sessionId, eventTime])
  @@index([requestId])
}
```

设计说明：

- 保留 `eventPayload`，避免每次加一个按钮名都要改 schema
- `eventTime` 与 `createdAt` 并存更稳妥：
  - `eventTime` 表示事件实际发生时间
  - `createdAt` 表示落库时间
- `sessionId`、`requestId` 首版建议先允许空，便于兼容历史事件和渐进迁移

## 5. 扩展 `Application`

```prisma
model Application {
  id                           String             @id @default(cuid())
  expertId                     String
  invitationId                 String             @unique
  applicationStatus            ApplicationStatus  @default(INIT)
  currentStep                  String?
  eligibilityResult            EligibilityResult  @default(UNKNOWN)
  latestAnalysisJobId          String?

  firstAccessedAt              DateTime?
  lastAccessedAt               DateTime?
  introConfirmedAt             DateTime?
  resumeUploadStartedAt        DateTime?
  resumeUploadedAt             DateTime?
  analysisStartedAt            DateTime?
  analysisCompletedAt          DateTime?
  materialsEnteredAt           DateTime?
  submittedAt                  DateTime?

  screeningPassportFullName    String?
  screeningContactEmail        String?
  productInnovationDescription String?           @db.Text
  createdAt                    DateTime           @default(now())
  updatedAt                    DateTime           @updatedAt
}
```

建议索引：

```prisma
@@index([firstAccessedAt])
@@index([lastAccessedAt])
@@index([introConfirmedAt])
@@index([resumeUploadedAt])
@@index([analysisCompletedAt])
@@index([materialsEnteredAt])
@@index([submittedAt])
```

## 6. 新增 `FileUploadAttempt`

```prisma
model FileUploadAttempt {
  id                String             @id @default(cuid())
  applicationId     String
  kind              UploadKind
  category          MaterialCategory?
  fileName          String
  fileExt           String?
  fileSize          Int?
  intentCreatedAt   DateTime?
  uploadStartedAt   DateTime?
  uploadConfirmedAt DateTime?
  uploadFailedAt    DateTime?
  failureCode       String?
  failureStage      UploadFailureStage?
  durationMs        Int?
  objectKey         String?
  sessionId         String?
  requestId         String?
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt

  application       Application        @relation(fields: [applicationId], references: [id])

  @@index([applicationId, kind, createdAt])
  @@index([applicationId, category, createdAt])
  @@index([kind, createdAt])
  @@index([failureStage, createdAt])
  @@index([sessionId, createdAt])
  @@index([requestId])
}
```

## 7. 关系调整

```prisma
model ExpertInvitation {
  ...
  accessLogs InviteAccessLog[]
}

model Application {
  ...
  events             ApplicationEventLog[]
  accessLogs         InviteAccessLog[]
  fileUploadAttempts FileUploadAttempt[]
}
```

## 8. 索引策略建议

首版重点支持四类查询：

- 时间序列查询
  - 所有日志表都应有 `occurredAt/eventTime/createdAt` 索引
- 漏斗与转化查询
  - `ApplicationEventLog(applicationId, eventTime)`
  - `ApplicationEventLog(eventType, eventTime)`
  - `Application(submittedAt)`
  - `Application(resumeUploadedAt)`
  - `Application(materialsEnteredAt)`
- 风控与访问监控
  - `InviteAccessLog(accessResult, occurredAt)`
  - `InviteAccessLog(tokenStatus, occurredAt)`
  - `InviteAccessLog(sessionId, occurredAt)`
  - 如后续按 IP 聚合频繁，可补 `@@index([ipHash, occurredAt])`
- 上传失败诊断
  - `FileUploadAttempt(kind, createdAt)`
  - `FileUploadAttempt(failureStage, createdAt)`
  - `FileUploadAttempt(applicationId, kind, createdAt)`

## 9. 迁移策略建议

第一步：

- 新增枚举
- 新建 `InviteAccessLog`
- 新建 `FileUploadAttempt`
- 给 `Application`、`ApplicationEventLog` 增加新字段，但尽量允许空值
- 新增索引

第二步：

- 应用代码完成双写和新埋点接入后
- 观察 1 到 2 个发布周期
- 再评估是否把 `ApplicationEventLog.sessionId`、`requestId`、`eventTime` 等升级为非空约束

## 10. 回填建议

建议回填：

- `ApplicationEventLog.eventTime = createdAt`
- `Application.submittedAt` 保持现状
- `Application.lastAccessedAt` 可谨慎回填为最近一次已知业务事件时间

不建议强行回填：

- `firstAccessedAt`
- `introConfirmedAt`
- `resumeUploadStartedAt`
- `analysisStartedAt`
- `materialsEnteredAt`

## 11. 兼容性注意点

- 当前内存数据模式 `src/lib/data/store.ts` 也需要同步扩展，否则本地 `memory` 模式会和 Prisma 模式能力不一致
- `seed.ts` 不一定要一次性补齐所有新表样例，但至少应补几条：
  - 有效 invite 访问
  - 无效/过期 invite 访问
  - 上传成功
  - 上传失败
- 若后面报表查询很多，可能还需要补物化视图或聚合表，但这不属于首版 schema 必需项

## 12. 推荐结论

- `InviteAccessLog`：单独建表，解决入口流量和无效 token 可观测性
- `ApplicationEventLog`：扩字段，不替换，保留现有兼容性
- `Application`：补里程碑时间，直接服务阶段耗时与转化计算
- `FileUploadAttempt`：单独建表，解决上传成功率和失败阶段归因
