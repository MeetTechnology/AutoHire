"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  ActionButton,
  DetailCard,
  PageFrame,
  PageShell,
  SectionCard,
  StatusBanner,
  getInputClassName,
} from "@/components/ui/page-shell";
import {
  confirmResumeUpload,
  createResumeUploadIntent,
  fetchSession,
  uploadBinary,
} from "@/features/application/client";
import { APPLICATION_FLOW_STEPS } from "@/features/application/constants";
import { resolveRouteFromStatus } from "@/features/application/route";
import type { ApplicationSnapshot } from "@/features/application/types";

export default function ResumePage() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<ApplicationSnapshot | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const nextSnapshot = await fetchSession();

        if (!active) {
          return;
        }

        if (
          !["INIT", "INTRO_VIEWED", "CV_UPLOADED"].includes(
            nextSnapshot.applicationStatus,
          )
        ) {
          router.replace(
            resolveRouteFromStatus(nextSnapshot.applicationStatus),
          );
          return;
        }

        setSnapshot(nextSnapshot);
      } catch (nextError) {
        if (active) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Unable to load the current application.",
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [router]);

  function handleUpload() {
    if (!snapshot || !selectedFile) {
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        const intent = await createResumeUploadIntent(
          snapshot.applicationId,
          selectedFile,
        );
        await uploadBinary(intent, selectedFile);
        await confirmResumeUpload(
          snapshot.applicationId,
          selectedFile,
          intent.objectKey,
        );
        router.push("/apply/result");
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Resume upload failed.",
        );
      }
    });
  }

  return (
    <PageFrame>
      <PageShell
        eyebrow="Resume Stage"
        title="Upload the resume that best represents your current profile."
        description="The system uses your resume for the initial eligibility review. After upload, the application moves directly into analysis and keeps you informed while processing is underway."
        steps={APPLICATION_FLOW_STEPS}
        currentStep={1}
        headerSlot={
          <SectionCard
            title="File guidance"
            description="Use a clean, readable version of your resume. If you already uploaded a file earlier, you may replace it with a newer version."
            className="bg-white/90"
          >
            <div className="space-y-3">
              <DetailCard
                eyebrow="Formats"
                title="PDF, Word, or ZIP"
                description="A standard PDF is preferred, though Word documents and ZIP archives are also accepted."
              />
              <DetailCard
                eyebrow="Limits"
                title="20 MB per file, 100 MB for ZIP"
                description="Larger submissions should be prepared as a ZIP archive to stay within the supported upload limits."
              />
            </div>
          </SectionCard>
        }
      >
        <div className="space-y-6">
          {isLoading ? (
            <StatusBanner
              tone="loading"
              title="Restoring your application"
              description="Checking your current progress before the upload step becomes available."
            />
          ) : null}

          {error ? (
            <StatusBanner
              tone="danger"
              title="The resume could not be uploaded"
              description={error}
            />
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <SectionCard
              title="Submission notes"
              description="The first analysis is based on the uploaded resume. If additional fields are needed later, the system will ask only for those missing items."
            >
              <div className="space-y-4">
                <DetailCard
                  eyebrow="Progress"
                  title="The next page shows a live review state"
                  description="You will be redirected to the analysis result page as soon as the upload confirmation completes."
                />
                {snapshot?.latestResumeFile ? (
                  <DetailCard
                    eyebrow="Existing file"
                    title={snapshot.latestResumeFile.fileName}
                    description={`Previously uploaded on ${new Date(
                      snapshot.latestResumeFile.uploadedAt,
                    ).toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}.`}
                  />
                ) : null}
              </div>
            </SectionCard>

            <SectionCard
              title="Upload resume"
              description="Select one file and confirm the upload to start the initial review."
            >
              <div className="space-y-5">
                <label className="block">
                  <input
                    type="file"
                    onChange={(event) => {
                      const nextFile = event.target.files?.[0] ?? null;
                      setSelectedFile(nextFile);
                    }}
                    className="sr-only"
                  />
                  <div className="rounded-[1.6rem] border border-dashed border-stone-300 bg-[linear-gradient(180deg,rgba(251,247,240,0.88),rgba(255,255,255,0.96))] px-6 py-10 text-center transition hover:border-stone-400 hover:bg-white">
                    <p className="text-sm font-semibold tracking-[0.22em] text-stone-500 uppercase">
                      Drag or Select
                    </p>
                    <p className="mt-3 font-[family-name:var(--font-serif)] text-3xl text-stone-950">
                      Choose your resume file
                    </p>
                    <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-stone-600">
                      Click anywhere in this panel to choose a file from your
                      device. The upload starts only after you confirm below.
                    </p>
                  </div>
                </label>

                <input
                  value={selectedFile?.name ?? ""}
                  readOnly
                  placeholder="No file selected yet"
                  className={getInputClassName("pointer-events-none")}
                />

                {selectedFile ? (
                  <div className="rounded-[1.4rem] border border-stone-200 bg-stone-50/80 p-4">
                    <p className="text-sm font-medium text-stone-950">
                      Selected file
                    </p>
                    <p className="mt-2 text-sm text-stone-700">
                      {selectedFile.name}
                    </p>
                    <p className="mt-1 text-xs tracking-[0.18em] text-stone-500 uppercase">
                      {Math.ceil(selectedFile.size / 1024)} KB
                    </p>
                  </div>
                ) : null}

                <ActionButton
                  onClick={handleUpload}
                  disabled={!selectedFile || isPending || isLoading}
                  className="w-full sm:w-auto"
                >
                  {isPending
                    ? "Uploading Resume..."
                    : "Upload and Start Analysis"}
                </ActionButton>
              </div>
            </SectionCard>
          </div>
        </div>
      </PageShell>
    </PageFrame>
  );
}
