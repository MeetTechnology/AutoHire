ALTER TABLE "ApplicationEventLog"
ADD COLUMN "ipAddress" TEXT;

ALTER TABLE "InviteAccessLog"
ADD COLUMN "ipAddress" TEXT;

CREATE INDEX "ApplicationEventLog_ipAddress_eventTime_idx"
ON "ApplicationEventLog"("ipAddress", "eventTime");

CREATE INDEX "InviteAccessLog_ipAddress_occurredAt_idx"
ON "InviteAccessLog"("ipAddress", "occurredAt");
