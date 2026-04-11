import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import {
  SAMPLE_TOKENS,
  getSampleInvitationSeeds,
} from "@/lib/data/sample-data";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to run prisma seed.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString,
  }),
});

async function main() {
  const invitations = getSampleInvitationSeeds();
  const now = new Date();

  await prisma.applicationEventLog.deleteMany();
  await prisma.applicationMaterial.deleteMany();
  await prisma.supplementalFieldSubmission.deleteMany();
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
          extractedFields: { name: "Progress Expert" },
          missingFields: [
            {
              fieldKey: "highest_degree",
              label: "最高学历",
              type: "select",
              required: true,
              options: ["本科", "硕士", "博士", "其他"],
            },
            {
              fieldKey: "current_employer",
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

  await prisma.application.create({
    data: {
      id: "app_submitted",
      expertId: "expert_submitted",
      invitationId: "invitation_submitted",
      applicationStatus: "SUBMITTED",
      currentStep: "materials",
      eligibilityResult: "ELIGIBLE",
      latestAnalysisJobId: "job_submitted",
      submittedAt: now,
      createdAt: now,
      updatedAt: now,
      resumeFiles: {
        create: {
          id: "resume_submitted",
          fileName: "candidate-submitted.pdf",
          objectKey: "applications/app_submitted/resume/candidate-submitted.pdf",
          fileType: "application/pdf",
          fileSize: 2048,
          versionNo: 1,
          uploadedAt: now,
        },
      },
      analysisJobs: {
        create: {
          id: "job_submitted",
          resumeFileId: "resume_submitted",
          externalJobId: "mock:eligible:submitted",
          jobType: "INITIAL",
          jobStatus: "COMPLETED",
          stageText: "已完成简历分析",
          startedAt: now,
          finishedAt: now,
        },
      },
      analysisResults: {
        create: {
          id: "result_submitted",
          analysisJobId: "job_submitted",
          analysisRound: 1,
          eligibilityResult: "ELIGIBLE",
          reasonText: "符合基本申报条件。",
          displaySummary: "您已通过初步资格判断，请继续上传证明材料。",
          extractedFields: { name: "Submitted Expert" },
          missingFields: [],
          createdAt: now,
        },
      },
      materials: {
        create: {
          id: "mat_submitted_identity",
          category: "IDENTITY",
          fileName: "passport.pdf",
          objectKey:
            "applications/app_submitted/materials/IDENTITY/passport.pdf",
          fileType: "application/pdf",
          fileSize: 1000,
          uploadedAt: now,
          isDeleted: false,
          deletedAt: null,
        },
      },
    },
  });

  console.log("Seeded AutoHire sample data.");
  console.log("Sample tokens:");
  console.log(`- init: ${SAMPLE_TOKENS.init}`);
  console.log(`- progress: ${SAMPLE_TOKENS.progress}`);
  console.log(`- submitted: ${SAMPLE_TOKENS.submitted}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
