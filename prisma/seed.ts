import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import {
  SAMPLE_TOKENS,
  getSampleSubmittedApplicationRecords,
  getSampleInvitationSeeds,
} from "@/lib/data/sample-data";
import { getMaterialSupplementSampleFixtures } from "@/lib/material-supplement/fixtures";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to run prisma seed.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString,
  }),
});

async function seedSubmittedApplication(
  sample: ReturnType<typeof getSampleSubmittedApplicationRecords>[number],
) {
  const { application, resumeFile, analysisJob, analysisResult, material } = sample;

  await prisma.application.create({
    data: {
      ...application,
      resumeFiles: {
        create: {
          id: resumeFile.id,
          fileName: resumeFile.fileName,
          objectKey: resumeFile.objectKey,
          fileType: resumeFile.fileType,
          fileSize: resumeFile.fileSize,
          versionNo: resumeFile.versionNo,
          uploadedAt: resumeFile.uploadedAt,
        },
      },
      analysisJobs: {
        create: {
          id: analysisJob.id,
          resumeFileId: analysisJob.resumeFileId,
          externalJobId: analysisJob.externalJobId,
          jobType: analysisJob.jobType,
          jobStatus: analysisJob.jobStatus,
          stageText: "已完成简历分析",
          errorMessage: analysisJob.errorMessage,
          startedAt: analysisJob.startedAt,
          finishedAt: analysisJob.finishedAt,
        },
      },
      analysisResults: {
        create: {
          id: analysisResult.id,
          analysisJobId: analysisResult.analysisJobId,
          analysisRound: analysisResult.analysisRound,
          eligibilityResult: analysisResult.eligibilityResult,
          reasonText: "符合基本申报条件。",
          displaySummary: "您已通过初步资格判断，请继续完成详细分析。",
          extractedFields: {
            "*姓名": application.screeningPassportFullName,
            "最高学位": "博士",
            "就职单位中文": analysisResult.extractedFields["就职单位中文"],
          },
          missingFields: analysisResult.missingFields,
          createdAt: analysisResult.createdAt,
        },
      },
      materials: {
        create: {
          id: material.id,
          category: material.category,
          fileName: material.fileName,
          objectKey: material.objectKey,
          fileType: material.fileType,
          fileSize: material.fileSize,
          uploadedAt: material.uploadedAt,
          isDeleted: material.isDeleted,
          deletedAt: material.deletedAt,
        },
      },
    },
  });
}

async function main() {
  const invitations = getSampleInvitationSeeds();
  const now = new Date();
  const submittedApplicationRecords = getSampleSubmittedApplicationRecords(now);
  const supplementFixtures = getMaterialSupplementSampleFixtures(now);

  await prisma.fileUploadAttempt.deleteMany();
  await prisma.inviteAccessLog.deleteMany();
  await prisma.applicationEventLog.deleteMany();
  await prisma.applicationFeedback.deleteMany();
  await prisma.supplementFile.deleteMany();
  await prisma.supplementUploadBatch.deleteMany();
  await prisma.supplementRequest.deleteMany();
  await prisma.materialCategoryReview.deleteMany();
  await prisma.materialReviewRun.deleteMany();
  await prisma.applicationMaterial.deleteMany();
  await prisma.secondaryAnalysisFieldValue.deleteMany();
  await prisma.secondaryAnalysisRun.deleteMany();
  await prisma.supplementalFieldSubmission.deleteMany();
  await prisma.resumeExtractionReview.deleteMany();
  await prisma.resumeAnalysisResult.deleteMany();
  await prisma.resumeAnalysisJob.deleteMany();
  await prisma.resumeFile.deleteMany();
  await prisma.application.deleteMany();
  await prisma.expertInvitation.deleteMany();

  for (const invitation of invitations) {
    await prisma.expertInvitation.create({
      data: invitation,
    });
  }

  await prisma.application.create({
    data: {
      id: "app_progress",
      expertId: "expert_progress",
      invitationId: "invitation_progress",
      applicationStatus: "INFO_REQUIRED",
      currentStep: "supplemental_fields",
      eligibilityResult: "INSUFFICIENT_INFO",
      latestAnalysisJobId: "job_progress",
      firstAccessedAt: now,
      lastAccessedAt: now,
      introConfirmedAt: now,
      resumeUploadStartedAt: now,
      resumeUploadedAt: now,
      analysisStartedAt: now,
      analysisCompletedAt: now,
      createdAt: now,
      updatedAt: now,
      resumeFiles: {
        create: {
          id: "resume_progress",
          fileName: "candidate-progress.pdf",
          objectKey: "applications/app_progress/resume/candidate-progress.pdf",
          fileType: "application/pdf",
          fileSize: 1024,
          versionNo: 1,
          uploadedAt: now,
        },
      },
      analysisJobs: {
        create: {
          id: "job_progress",
          resumeFileId: "resume_progress",
          externalJobId: "mock:insufficient_info:progress",
          jobType: "INITIAL",
          jobStatus: "COMPLETED",
          stageText: "已完成简历分析",
          startedAt: now,
          finishedAt: now,
        },
      },
      analysisResults: {
        create: {
          id: "result_progress",
          analysisJobId: "job_progress",
          analysisRound: 1,
          eligibilityResult: "INSUFFICIENT_INFO",
          reasonText: "缺少最高学历与当前工作单位信息。",
          displaySummary: "当前无法完成资格判断，缺少关键信息。",
          extractedFields: {
            "*姓名": "Progress Expert",
            "性别": "女",
            "*出生日期（无则1900-01-01）": "1900-01-01",
            "最高学位": "",
            "就职单位中文": "",
            "（省/国）入选信息": "国家级人才计划（2021）",
            "备注": "内部字段不面向专家展示",
            __rawReasoning:
              "系统已识别部分背景信息，但仍缺少关键资格判断字段。",
          },
          missingFields: [
            {
              fieldKey: "highest_degree",
              sourceItemName: "最高学位",
              label: "最高学历",
              type: "select",
              required: true,
              options: ["本科", "硕士", "博士", "其他"],
            },
            {
              fieldKey: "current_employer",
              sourceItemName: "当前工作单位",
              label: "当前工作单位",
              type: "text",
              required: true,
            },
          ],
          createdAt: now,
        },
      },
    },
  });

  for (const sample of submittedApplicationRecords) {
    await seedSubmittedApplication(sample);
  }

  await prisma.application.create({
    data: {
      id: "app_secondary",
      expertId: "expert_secondary",
      invitationId: "invitation_secondary",
      applicationStatus: "ELIGIBLE",
      currentStep: "result",
      eligibilityResult: "ELIGIBLE",
      latestAnalysisJobId: "job_secondary",
      firstAccessedAt: now,
      lastAccessedAt: now,
      introConfirmedAt: now,
      resumeUploadStartedAt: now,
      resumeUploadedAt: now,
      analysisStartedAt: now,
      analysisCompletedAt: now,
      createdAt: now,
      updatedAt: now,
      resumeFiles: {
        create: {
          id: "resume_secondary",
          fileName: "candidate-secondary.pdf",
          objectKey: "applications/app_secondary/resume/candidate-secondary.pdf",
          fileType: "application/pdf",
          fileSize: 2048,
          versionNo: 1,
          uploadedAt: now,
        },
      },
      analysisJobs: {
        create: {
          id: "job_secondary",
          resumeFileId: "resume_secondary",
          externalJobId: "mock:eligible:secondary",
          jobType: "INITIAL",
          jobStatus: "COMPLETED",
          stageText: "已完成简历分析",
          startedAt: now,
          finishedAt: now,
        },
      },
      analysisResults: {
        create: {
          id: "result_secondary",
          analysisJobId: "job_secondary",
          analysisRound: 1,
          eligibilityResult: "ELIGIBLE",
          reasonText: "符合基本申报条件。",
          displaySummary: "您已通过初步资格判断，请继续完成详细分析。",
          extractedFields: {
            "*姓名": "Secondary Expert",
            "最高学位": "博士",
            "就职单位中文": "Example Institute",
            "研究方向": "Marine biotechnology",
          },
          missingFields: [],
          createdAt: now,
        },
      },
    },
  });

  for (const run of supplementFixtures.materialReviewRuns) {
    await prisma.materialReviewRun.create({
      data: {
        ...run,
      },
    });
  }

  for (const review of supplementFixtures.materialCategoryReviews) {
    await prisma.materialCategoryReview.create({
      data: {
        ...review,
      },
    });
  }

  for (const request of supplementFixtures.supplementRequests) {
    await prisma.supplementRequest.create({
      data: {
        ...request,
      },
    });
  }

  for (const batch of supplementFixtures.supplementUploadBatches) {
    await prisma.supplementUploadBatch.create({
      data: {
        ...batch,
      },
    });
  }

  for (const file of supplementFixtures.supplementFiles) {
    await prisma.supplementFile.create({
      data: {
        ...file,
      },
    });
  }

  await prisma.inviteAccessLog.createMany({
    data: [
      {
        invitationId: "invitation_init",
        applicationId: "app_progress",
        tokenStatus: "ACTIVE",
        accessResult: "VALID",
        ipAddress: "203.0.113.10",
        landingPath: "/apply",
        sessionId: "seed_session_valid",
        requestId: "seed_request_valid",
        occurredAt: now,
      },
      {
        tokenStatus: "UNKNOWN",
        accessResult: "INVALID",
        ipAddress: "198.51.100.24",
        landingPath: "/apply",
        sessionId: "seed_session_invalid",
        requestId: "seed_request_invalid",
        occurredAt: now,
      },
    ],
  });

  await prisma.fileUploadAttempt.createMany({
    data: [
      {
        applicationId: "app_progress",
        uploadId: "seed_resume_upload",
        kind: "RESUME",
        fileName: "candidate-progress.pdf",
        fileExt: "pdf",
        fileSize: 1024,
        intentCreatedAt: now,
        uploadStartedAt: now,
        uploadConfirmedAt: now,
        durationMs: 0,
        objectKey: "applications/app_progress/resume/candidate-progress.pdf",
        sessionId: "seed_session_valid",
        requestId: "seed_request_valid",
      },
      {
        applicationId: "app_submitted",
        uploadId: "seed_material_upload_failed",
        kind: "MATERIAL",
        category: "IDENTITY",
        fileName: "passport.pdf",
        fileExt: "pdf",
        fileSize: 1000,
        intentCreatedAt: now,
        uploadStartedAt: now,
        uploadFailedAt: now,
        failureCode: "oss_put_failed",
        failureStage: "PUT",
        durationMs: 0,
        objectKey: "applications/app_submitted/materials/IDENTITY/passport.pdf",
        sessionId: "seed_session_valid",
        requestId: "seed_request_upload_fail",
      },
    ],
  });

  console.log("Seeded AutoHire sample data.");
  console.log("Sample tokens:");
  console.log(`- init: ${SAMPLE_TOKENS.init}`);
  console.log(`- progress: ${SAMPLE_TOKENS.progress}`);
  console.log(`- submitted: ${SAMPLE_TOKENS.submitted}`);
  console.log(`- supplement reviewing: ${SAMPLE_TOKENS.supplementReviewing}`);
  console.log(`- supplement required: ${SAMPLE_TOKENS.supplementRequired}`);
  console.log(`- supplement satisfied: ${SAMPLE_TOKENS.supplementSatisfied}`);
  console.log(`- secondary: ${SAMPLE_TOKENS.secondary}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
