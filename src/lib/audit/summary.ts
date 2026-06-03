import { getRuntimeMode } from "@/lib/env";

export type AuditRange = "7d" | "30d" | "all";

export type AuditCountSlice = {
  name: string;
  value: number;
};

export type AuditLatestEvent = {
  id: string;
  applicationId: string;
  eventTime: string;
  eventType: string;
  pageName: string | null;
  actionName: string | null;
  eventStatus: string | null;
  requestId: string | null;
};

export type AuditDashboardSummary = {
  isAvailable: boolean;
  range: AuditRange;
  generatedAt: string;
  totals: {
    applications: number;
    applicationEventLogs: number;
    inviteAccessLogs: number;
    fileUploadAttempts: number;
    askAiChatSessions: number;
    askAiChatMessages: number;
    askAiMessageFeedback: number;
    materialReviewRuns: number;
    materialCategoryReviews: number;
    supplementRequests: number;
  };
  milestones: Array<{
    key: string;
    label: string;
    value: number;
  }>;
  distributions: {
    applicationStatus: AuditCountSlice[];
    eligibilityResult: AuditCountSlice[];
    inviteAccessResult: AuditCountSlice[];
    uploadKind: AuditCountSlice[];
    uploadFailureStage: AuditCountSlice[];
    materialReviewRunStatus: AuditCountSlice[];
    materialCategoryReviewStatus: AuditCountSlice[];
    supplementRequestStatus: AuditCountSlice[];
    askAiFeedbackRating: AuditCountSlice[];
  };
  behavior: {
    actions: AuditCountSlice[];
    pages: AuditCountSlice[];
    eventTypes: AuditCountSlice[];
    pageDurationMs: Array<{
      pageName: string;
      averageMs: number;
      samples: number;
    }>;
  };
  uploads: {
    categories: AuditCountSlice[];
    recentFailures: Array<{
      id: string;
      applicationId: string;
      kind: string;
      category: string | null;
      fileName: string;
      failureStage: string | null;
      failureCode: string | null;
      uploadFailedAt: string | null;
      createdAt: string;
    }>;
  };
  latestEvents: AuditLatestEvent[];
};

const RANGE_DAYS: Record<Exclude<AuditRange, "all">, number> = {
  "7d": 7,
  "30d": 30,
};

const MILESTONE_LABELS = {
  firstAccessedAt: "First access",
  introConfirmedAt: "Intro confirmed",
  resumeUploadStartedAt: "Resume upload started",
  resumeUploadedAt: "Resume uploaded",
  analysisStartedAt: "Analysis started",
  analysisCompletedAt: "Analysis completed",
  materialsEnteredAt: "Materials viewed",
  submittedAt: "Submitted",
} as const;

export function resolveAuditRange(value: string | null | undefined): AuditRange {
  if (value === "7d" || value === "30d" || value === "all") {
    return value;
  }

  return "30d";
}

export function getAuditRangeStart(range: AuditRange, now = new Date()) {
  if (range === "all") {
    return null;
  }

  const start = new Date(now);
  start.setDate(start.getDate() - RANGE_DAYS[range]);
  return start;
}

function emptySummary(range: AuditRange): AuditDashboardSummary {
  return {
    isAvailable: false,
    range,
    generatedAt: new Date().toISOString(),
    totals: {
      applications: 0,
      applicationEventLogs: 0,
      inviteAccessLogs: 0,
      fileUploadAttempts: 0,
      askAiChatSessions: 0,
      askAiChatMessages: 0,
      askAiMessageFeedback: 0,
      materialReviewRuns: 0,
      materialCategoryReviews: 0,
      supplementRequests: 0,
    },
    milestones: Object.entries(MILESTONE_LABELS).map(([key, label]) => ({
      key,
      label,
      value: 0,
    })),
    distributions: {
      applicationStatus: [],
      eligibilityResult: [],
      inviteAccessResult: [],
      uploadKind: [],
      uploadFailureStage: [],
      materialReviewRunStatus: [],
      materialCategoryReviewStatus: [],
      supplementRequestStatus: [],
      askAiFeedbackRating: [],
    },
    behavior: {
      actions: [],
      pages: [],
      eventTypes: [],
      pageDurationMs: [],
    },
    uploads: {
      categories: [],
      recentFailures: [],
    },
    latestEvents: [],
  };
}

function toCountSlice<T extends Record<string, unknown>>(
  rows: T[],
  key: keyof T,
) {
  return rows
    .map((row) => ({
      name: String(row[key] ?? "Unknown"),
      value: Number(
        (row._count as { _all?: number } | undefined)?._all ??
          (row._count as number | undefined) ??
          0,
      ),
    }))
    .filter((item) => item.value > 0)
    .sort((left, right) => right.value - left.value);
}

function toDateFilter(start: Date | null) {
  return start ? { gte: start } : undefined;
}

export async function getAuditDashboardSummary(input?: {
  range?: AuditRange;
}): Promise<AuditDashboardSummary> {
  const range = input?.range ?? "30d";

  if (getRuntimeMode() !== "prisma") {
    return emptySummary(range);
  }

  const { prisma } = await import("@/lib/db/prisma");
  const rangeStart = getAuditRangeStart(range);
  const generatedAt = new Date().toISOString();
  const eventTime = toDateFilter(rangeStart);
  const occurredAt = toDateFilter(rangeStart);
  const createdAt = toDateFilter(rangeStart);

  const [
    totals,
    applicationStatus,
    eligibilityResult,
    inviteAccessResult,
    uploadKind,
    uploadFailureStage,
    materialReviewRunStatus,
    materialCategoryReviewStatus,
    supplementRequestStatus,
    askAiFeedbackRating,
    actions,
    pages,
    eventTypes,
    pageDurationRows,
    uploadCategories,
    recentFailures,
    latestEvents,
    milestoneCounts,
  ] = await Promise.all([
    getTotals(createdAt),
    prisma.application.groupBy({
      by: ["applicationStatus"],
      _count: { _all: true },
    }),
    prisma.application.groupBy({
      by: ["eligibilityResult"],
      _count: { _all: true },
    }),
    prisma.inviteAccessLog.groupBy({
      by: ["accessResult"],
      where: occurredAt ? { occurredAt } : undefined,
      _count: { _all: true },
    }),
    prisma.fileUploadAttempt.groupBy({
      by: ["kind"],
      where: createdAt ? { createdAt } : undefined,
      _count: { _all: true },
    }),
    prisma.fileUploadAttempt.groupBy({
      by: ["failureStage"],
      where: createdAt ? { createdAt } : undefined,
      _count: { _all: true },
    }),
    prisma.materialReviewRun.groupBy({
      by: ["status"],
      where: createdAt ? { createdAt } : undefined,
      _count: { _all: true },
    }),
    prisma.materialCategoryReview.groupBy({
      by: ["status"],
      where: createdAt ? { createdAt } : undefined,
      _count: { _all: true },
    }),
    prisma.supplementRequest.groupBy({
      by: ["status"],
      where: createdAt ? { createdAt } : undefined,
      _count: { _all: true },
    }),
    prisma.askAiMessageFeedback.groupBy({
      by: ["rating"],
      where: createdAt ? { createdAt } : undefined,
      _count: { _all: true },
    }),
    prisma.applicationEventLog.groupBy({
      by: ["actionName"],
      where: eventTime ? { eventTime } : undefined,
      _count: { _all: true },
    }),
    prisma.applicationEventLog.groupBy({
      by: ["pageName"],
      where: eventTime ? { eventTime } : undefined,
      _count: { _all: true },
    }),
    prisma.applicationEventLog.groupBy({
      by: ["eventType"],
      where: eventTime ? { eventTime } : undefined,
      _count: { _all: true },
    }),
    prisma.applicationEventLog.groupBy({
      by: ["pageName"],
      where: {
        ...(eventTime ? { eventTime } : {}),
        actionName: "page_duration",
        durationMs: { not: null },
      },
      _avg: { durationMs: true },
      _count: { _all: true },
    }),
    prisma.fileUploadAttempt.groupBy({
      by: ["category"],
      where: createdAt ? { createdAt } : undefined,
      _count: { _all: true },
    }),
    prisma.fileUploadAttempt.findMany({
      where: {
        ...(createdAt ? { createdAt } : {}),
        uploadFailedAt: { not: null },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.applicationEventLog.findMany({
      where: eventTime ? { eventTime } : undefined,
      orderBy: { eventTime: "desc" },
      take: 25,
      select: {
        id: true,
        applicationId: true,
        eventTime: true,
        eventType: true,
        pageName: true,
        actionName: true,
        eventStatus: true,
        requestId: true,
      },
    }),
    getMilestoneCounts(),
  ]);

  return {
    isAvailable: true,
    range,
    generatedAt,
    totals,
    milestones: Object.entries(MILESTONE_LABELS).map(([key, label]) => ({
      key,
      label,
      value: milestoneCounts[key as keyof typeof MILESTONE_LABELS],
    })),
    distributions: {
      applicationStatus: toCountSlice(applicationStatus, "applicationStatus"),
      eligibilityResult: toCountSlice(eligibilityResult, "eligibilityResult"),
      inviteAccessResult: toCountSlice(inviteAccessResult, "accessResult"),
      uploadKind: toCountSlice(uploadKind, "kind"),
      uploadFailureStage: toCountSlice(uploadFailureStage, "failureStage"),
      materialReviewRunStatus: toCountSlice(
        materialReviewRunStatus,
        "status",
      ),
      materialCategoryReviewStatus: toCountSlice(
        materialCategoryReviewStatus,
        "status",
      ),
      supplementRequestStatus: toCountSlice(supplementRequestStatus, "status"),
      askAiFeedbackRating: toCountSlice(askAiFeedbackRating, "rating"),
    },
    behavior: {
      actions: toCountSlice(actions, "actionName"),
      pages: toCountSlice(pages, "pageName"),
      eventTypes: toCountSlice(eventTypes, "eventType").slice(0, 12),
      pageDurationMs: pageDurationRows
        .map((row) => ({
          pageName: row.pageName ?? "Unknown",
          averageMs: Math.round(row._avg.durationMs ?? 0),
          samples: row._count._all,
        }))
        .sort((left, right) => right.averageMs - left.averageMs),
    },
    uploads: {
      categories: toCountSlice(uploadCategories, "category"),
      recentFailures: recentFailures.map((row) => ({
        id: row.id,
        applicationId: row.applicationId,
        kind: row.kind,
        category: row.category,
        fileName: row.fileName,
        failureStage: row.failureStage,
        failureCode: row.failureCode,
        uploadFailedAt: row.uploadFailedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
    },
    latestEvents: latestEvents.map((row) => ({
      ...row,
      eventTime: row.eventTime.toISOString(),
    })),
  };

  async function getTotals(dateFilter: { gte: Date } | undefined) {
    const [
      applications,
      applicationEventLogs,
      inviteAccessLogs,
      fileUploadAttempts,
      askAiChatSessions,
      askAiChatMessages,
      askAiMessageFeedback,
      materialReviewRuns,
      materialCategoryReviews,
      supplementRequests,
    ] = await Promise.all([
      prisma.application.count(),
      prisma.applicationEventLog.count({
        where: dateFilter ? { eventTime: dateFilter } : undefined,
      }),
      prisma.inviteAccessLog.count({
        where: dateFilter ? { occurredAt: dateFilter } : undefined,
      }),
      prisma.fileUploadAttempt.count({
        where: dateFilter ? { createdAt: dateFilter } : undefined,
      }),
      prisma.askAiChatSession.count({
        where: dateFilter ? { createdAt: dateFilter } : undefined,
      }),
      prisma.askAiChatMessage.count({
        where: dateFilter ? { createdAt: dateFilter } : undefined,
      }),
      prisma.askAiMessageFeedback.count({
        where: dateFilter ? { createdAt: dateFilter } : undefined,
      }),
      prisma.materialReviewRun.count({
        where: dateFilter ? { createdAt: dateFilter } : undefined,
      }),
      prisma.materialCategoryReview.count({
        where: dateFilter ? { createdAt: dateFilter } : undefined,
      }),
      prisma.supplementRequest.count({
        where: dateFilter ? { createdAt: dateFilter } : undefined,
      }),
    ]);

    return {
      applications,
      applicationEventLogs,
      inviteAccessLogs,
      fileUploadAttempts,
      askAiChatSessions,
      askAiChatMessages,
      askAiMessageFeedback,
      materialReviewRuns,
      materialCategoryReviews,
      supplementRequests,
    };
  }

  async function getMilestoneCounts() {
    const result = await prisma.application.aggregate({
      _count: {
        firstAccessedAt: true,
        introConfirmedAt: true,
        resumeUploadStartedAt: true,
        resumeUploadedAt: true,
        analysisStartedAt: true,
        analysisCompletedAt: true,
        materialsEnteredAt: true,
        submittedAt: true,
      },
    });

    return result._count;
  }
}
