-- Invite PV / UV
SELECT COUNT(*) AS invite_pv
FROM "InviteAccessLog"
WHERE "accessResult" = 'VALID';

SELECT COUNT(DISTINCT "sessionId") AS invite_uv
FROM "InviteAccessLog"
WHERE "accessResult" = 'VALID';

-- Invalid / expired / disabled rates
SELECT
  SUM(CASE WHEN "accessResult" = 'INVALID' THEN 1 ELSE 0 END) AS invalid_pv,
  SUM(CASE WHEN "accessResult" = 'EXPIRED' THEN 1 ELSE 0 END) AS expired_pv,
  SUM(CASE WHEN "accessResult" = 'DISABLED' THEN 1 ELSE 0 END) AS disabled_pv,
  COUNT(*) AS total_access_attempts
FROM "InviteAccessLog"
WHERE "accessResult" IN ('VALID', 'INVALID', 'EXPIRED', 'DISABLED');

-- Raw IP lookup
SELECT
  "ipAddress",
  "ipHash",
  "accessResult",
  "sessionId",
  "occurredAt"
FROM "InviteAccessLog"
WHERE "ipAddress" IS NOT NULL
ORDER BY "occurredAt" DESC;

SELECT
  "ipAddress",
  "ipHash",
  "eventType",
  "applicationId",
  "sessionId",
  "eventTime"
FROM "ApplicationEventLog"
WHERE "ipAddress" IS NOT NULL
ORDER BY "eventTime" DESC;

-- Resume upload success / fail by stage
SELECT
  "kind",
  "failureStage",
  COUNT(*) AS attempts,
  SUM(CASE WHEN "uploadConfirmedAt" IS NOT NULL THEN 1 ELSE 0 END) AS success_count,
  SUM(CASE WHEN "uploadFailedAt" IS NOT NULL THEN 1 ELSE 0 END) AS fail_count
FROM "FileUploadAttempt"
GROUP BY "kind", "failureStage"
ORDER BY "kind", "failureStage";

-- Intro -> submitted funnel
SELECT
  COUNT(DISTINCT CASE WHEN "eventType" = 'intro_page_viewed' THEN "applicationId" END) AS intro_view_applications,
  COUNT(DISTINCT CASE WHEN "eventType" = 'materials_page_viewed' THEN "applicationId" END) AS materials_view_applications,
  COUNT(DISTINCT CASE WHEN "submittedAt" IS NOT NULL THEN "id" END) AS submitted_applications
FROM "Application"
LEFT JOIN "ApplicationEventLog" ON "ApplicationEventLog"."applicationId" = "Application"."id";

-- Stage timing
SELECT
  AVG(EXTRACT(EPOCH FROM ("submittedAt" - "firstAccessedAt"))) * 1000 AS avg_first_access_to_submit_ms,
  AVG(EXTRACT(EPOCH FROM ("analysisCompletedAt" - "resumeUploadedAt"))) * 1000 AS avg_resume_to_analysis_complete_ms
FROM "Application"
WHERE "submittedAt" IS NOT NULL OR "analysisCompletedAt" IS NOT NULL;
