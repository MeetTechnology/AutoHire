"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Mail, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";

import {
  MetaStrip,
  PageFrame,
  PageShell,
  SectionCard,
  StatusBanner,
  getButtonClassName,
} from "@/components/ui/page-shell";
import {
  APPLICATION_FLOW_STEPS_WITH_INTRO,
  SUBMISSION_COMPLETE_CONTACT_EMAIL,
  SUBMISSION_COMPLETE_WHATSAPP_URL,
} from "@/features/application/constants";
import { fetchSession } from "@/features/application/client";
import {
  buildApplyFlowStepLinks,
  resolveRouteFromStatus,
} from "@/features/application/route";
import type { ApplicationSnapshot } from "@/features/application/types";

const SUBMISSION_MESSAGE =
  "We have received your application. Our team will contact you within one week to arrange the follow-up declaration procedures. Please keep your lines of communication open.";

export default function SubmissionCompletePage() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<ApplicationSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const nextSnapshot = await fetchSession();

        if (!active) {
          return;
        }

        if (nextSnapshot.applicationStatus !== "SUBMITTED") {
          router.replace(resolveRouteFromStatus(nextSnapshot.applicationStatus));
          return;
        }

        setSnapshot(nextSnapshot);
      } catch (nextError) {
        if (active) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Unable to load the submitted application.",
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

  const flowStepLinks = useMemo(
    () => buildApplyFlowStepLinks(snapshot?.applicationStatus ?? "SUBMITTED"),
    [snapshot?.applicationStatus],
  );

  return (
    <PageFrame>
      <PageShell
        title="Submission complete"
        description="Your application package has been submitted successfully."
        headerVariant="centered"
        steps={APPLICATION_FLOW_STEPS_WITH_INTRO}
        currentStep={3}
        stepIndexing="zero"
        stepLinks={flowStepLinks}
        maxAccessibleStep={3}
      >
        <div className="mx-auto max-w-3xl space-y-4">
          {error ? (
            <StatusBanner
              tone="danger"
              title="The submitted application could not be loaded"
              description={error}
            />
          ) : null}

          {isLoading ? (
            <StatusBanner
              tone="loading"
              title="Loading submitted application"
              description="Restoring your final submission status."
            />
          ) : null}

          {!isLoading && !error && snapshot ? (
            <SectionCard
              title="Application Submitted"
              description={SUBMISSION_MESSAGE}
            >
              <div className="flex flex-col gap-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <CheckCircle2
                  className="h-10 w-10 text-[color:var(--accent)]"
                  aria-hidden
                />
                <div className="flex flex-col gap-3 text-sm leading-6 text-[color:var(--foreground-soft)]">
                  <p>
                    Please add the overseas talent consultant via WeChat or
                    WhatsApp using the QR code below.
                  </p>
                  <MetaStrip
                    items={[
                      {
                        label: "Email",
                        value: SUBMISSION_COMPLETE_CONTACT_EMAIL,
                      },
                    ]}
                  />
                </div>

                <div className="grid gap-4 rounded-2xl border border-[color:var(--border)] bg-white p-4 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--primary)]">
                      <MessageCircle className="h-4 w-4" aria-hidden />
                      WhatsApp
                    </div>
                    <p className="text-sm leading-6 text-[color:var(--foreground-soft)]">
                      Scan the QR code with your phone to add the overseas
                      talent consultant on WhatsApp.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={`mailto:${SUBMISSION_COMPLETE_CONTACT_EMAIL}`}
                        className={getButtonClassName("secondary")}
                      >
                        <Mail className="h-4 w-4" aria-hidden />
                        Email
                      </a>
                      <a
                        href={SUBMISSION_COMPLETE_WHATSAPP_URL}
                        className={getButtonClassName("success")}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MessageCircle className="h-4 w-4" aria-hidden />
                        Open WhatsApp
                      </a>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <div className="rounded-2xl border border-[color:var(--border)] bg-white p-3 shadow-[var(--shadow-card)]">
                      <QRCodeSVG
                        value={SUBMISSION_COMPLETE_WHATSAPP_URL}
                        size={180}
                        level="M"
                        marginSize={4}
                        title="WhatsApp QR code for contacting the overseas talent consultant"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>
          ) : null}
        </div>
      </PageShell>
    </PageFrame>
  );
}
