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
          displaySummary: "您已通过初步资格判断，请继续完成详细分析。",
          extractedFields: {
            "*姓名": "Submitted Expert",
            "最高学位": "博士",
            "就职单位中文": "Example University",
          },
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

  await prisma.application.create({
    data: {
      id: "app_secondary",
      expertId: "expert_secondary",
      invitationId: "invitation_secondary",
      applicationStatus: "ELIGIBLE",
      currentStep: "result",
      eligibilityResult: "ELIGIBLE",
      latestAnalysisJobId: "job_secondary",
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

  console.log("Seeded AutoHire sample data.");
  console.log("Sample tokens:");
  console.log(`- init: ${SAMPLE_TOKENS.init}`);
  console.log(`- progress: ${SAMPLE_TOKENS.progress}`);
  console.log(`- submitted: ${SAMPLE_TOKENS.submitted}`);
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
