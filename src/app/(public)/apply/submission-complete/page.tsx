"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  MessageCircle,
  PencilLine,
  Send,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";

import {
  PageFrame,
  PageShell,
  SectionCard,
  StatusBanner,
  getButtonClassName,
  getInputClassName,
} from "@/components/ui/page-shell";
import {
  APPLICATION_FEEDBACK_COMMENT_MAX_LENGTH,
  APPLICATION_FLOW_STEPS_WITH_INTRO,
  SUBMISSION_COMPLETE_CONTACT_EMAIL,
  SUBMISSION_COMPLETE_WECHAT_URL,
  SUBMISSION_COMPLETE_WHATSAPP_URL,
} from "@/features/application/constants";
import { fetchSession } from "@/features/application/client";
import {
  fetchApplicationFeedbackAction,
  saveFeedbackDraftAction,
  submitFeedbackAction,
} from "@/features/application/actions";
import {
  buildApplyFlowStepLinks,
  resolveRouteFromStatus,
} from "@/features/application/route";
import type {
  ApplicationFeedbackContext,
  ApplicationFeedbackSnapshot,
  ApplicationSnapshot,
  FeedbackDeviceType,
} from "@/features/application/types";
import {
  trackPageView,
  getOrCreateTrackingSessionId,
} from "@/lib/tracking/client";
import { usePageDurationTracking } from "@/lib/tracking/use-page-duration-tracking";
import { cn } from "@/lib/utils";

const SUBMISSION_HEADLINE =
  "Application Received! We will review your package and contact you within 1 week.";
const NEXT_STEP_MESSAGE =
  "Next Step: Connect with your dedicated Talent Consultant.";

/** Primary: 给我们留言 · Secondary: 如果您有任何想说的，请在这里告诉我们 */
const FEEDBACK_HEADING_PRIMARY = "Leave us a message";
const FEEDBACK_HEADING_SECONDARY =
  "If you have anything you'd like to say, please tell us here.";

/** Mid-size (“s”) success links under QR codes: between compact and full default height. */
const QR_CONTACT_OPEN_LINK_CLASS_NAME = cn(
  getButtonClassName("success"),
  "min-h-10 gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold w-auto",
);

function serializeFeedbackDraft(input: {
  rating: number | null;
  comment: string;
}) {
  return JSON.stringify({
    rating: input.rating,
    comment: input.comment.trim(),
  });
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function detectDeviceType(width: number): FeedbackDeviceType {
  if (width < 768) {
    return "mobile";
  }

  if (width < 1024) {
    return "tablet";
  }

  return "desktop";
}

function buildFeedbackContext(): ApplicationFeedbackContext {
  if (typeof window === "undefined") {
    return {
      flowName: "submission flow",
      flowStep: "feedback",
      deviceType: "unknown",
      isLoggedIn: false,
      surface: "completion_page",
    };
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  return {
    currentUrl: window.location.href,
    pageTitle: document.title,
    flowName: "submission flow",
    flowStep: "feedback",
    browserInfo: navigator.userAgent,
    deviceType: detectDeviceType(viewportWidth),
    viewportWidth,
    viewportHeight,
    isLoggedIn: false,
    userId: null,
    surface: "completion_page",
  };
}

export default function SubmissionCompletePage() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<ApplicationSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ApplicationFeedbackSnapshot>({
    status: "DRAFT",
    rating: null,
    comment: "",
    draftSavedAt: null,
    submittedAt: null,
  });
  const [isFeedbackReady, setIsFeedbackReady] = useState(false);
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(true);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const saveResetTimerRef = useRef<number | null>(null);
  const lastPersistedFeedbackRef = useRef(
    serializeFeedbackDraft({ rating: null, comment: "" }),
  );
  const hasTrackedViewRef = useRef(false);

  usePageDurationTracking({
    pageName: "apply_submission_complete",
    stepName: "feedback",
    applicationId:
      snapshot?.applicationStatus === "SUBMITTED"
        ? snapshot.applicationId
        : null,
  });

  useEffect(() => {
    let active = true;

    async function load() {
      let nextSnapshot: ApplicationSnapshot;

      try {
        nextSnapshot = await fetchSession();

        if (!active) {
          return;
        }

        if (nextSnapshot.applicationStatus !== "SUBMITTED") {
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
              : "Unable to load the submitted application.",
          );
        }
        return;
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }

      try {
        const nextFeedback = await fetchApplicationFeedbackAction(
          nextSnapshot.applicationId,
        );

        if (!active) {
          return;
        }

        setFeedback(nextFeedback);
        lastPersistedFeedbackRef.current = serializeFeedbackDraft({
          rating: nextFeedback.rating,
          comment: nextFeedback.comment,
        });
        setDraftError(null);
        setIsFeedbackReady(true);
      } catch (nextError) {
        if (active) {
          setDraftError(
            nextError instanceof Error
              ? nextError.message
              : "Feedback is temporarily unavailable, but your application was submitted successfully.",
          );
          setIsFeedbackReady(false);
        }
      } finally {
        if (active) {
          setIsFeedbackLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (
      !snapshot ||
      isLoading ||
      hasTrackedViewRef.current ||
      snapshot.applicationStatus !== "SUBMITTED"
    ) {
      return;
    }

    hasTrackedViewRef.current = true;
    void trackPageView({
      pageName: "apply_submission_complete",
      stepName: "feedback",
      applicationId: snapshot.applicationId,
    });
  }, [isLoading, snapshot]);

  const trimmedComment = feedback.comment.trim();
  const hasComment = trimmedComment.length > 0;
  const hasFeedbackContent = hasComment;
  const commentTooLong =
    feedback.comment.length > APPLICATION_FEEDBACK_COMMENT_MAX_LENGTH;

  useEffect(() => {
    if (
      !snapshot ||
      !isFeedbackReady ||
      feedback.status === "SUBMITTED" ||
      isSubmitting ||
      commentTooLong
    ) {
      return;
    }

    const serialized = serializeFeedbackDraft({
      rating: feedback.rating,
      comment: feedback.comment,
    });

    if (serialized === lastPersistedFeedbackRef.current) {
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        setSaveState("saving");
        setDraftError(null);

        const saved = await saveFeedbackDraftAction(
          snapshot.applicationId,
          {
            rating: feedback.rating,
            comment: feedback.comment,
            context: buildFeedbackContext(),
          },
          getOrCreateTrackingSessionId(),
        );

        lastPersistedFeedbackRef.current = serializeFeedbackDraft({
          rating: saved.rating,
          comment: saved.comment,
        });
        setFeedback(saved);
        setSaveState("saved");

        if (saveResetTimerRef.current) {
          window.clearTimeout(saveResetTimerRef.current);
        }

        saveResetTimerRef.current = window.setTimeout(() => {
          setSaveState("idle");
        }, 1400);
      } catch {
        setSaveState("error");
        setDraftError(
          "Draft couldn't be saved. Please copy your comment before leaving.",
        );
      }
    }, 850);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    commentTooLong,
    feedback.comment,
    feedback.rating,
    feedback.status,
    isFeedbackReady,
    isSubmitting,
    snapshot,
  ]);

  useEffect(() => {
    return () => {
      if (saveResetTimerRef.current) {
        window.clearTimeout(saveResetTimerRef.current);
      }
    };
  }, []);

  const flowStepLinks = useMemo(
    () => buildApplyFlowStepLinks(snapshot?.applicationStatus ?? "SUBMITTED"),
    [snapshot?.applicationStatus],
  );

  const isSubmitted = feedback.status === "SUBMITTED";
  const canSendFeedback =
    isFeedbackReady && hasFeedbackContent && !commentTooLong && !isSubmitting;
  const submitButtonLabel = isSubmitting
    ? "Sending..."
    : submitError
      ? "Try again"
      : "Send feedback";
  const liveMessage = isSubmitted
    ? "Thanks - your feedback was sent."
    : submitError
      ? "Feedback couldn't be sent. Please try again."
      : commentTooLong
        ? "Please shorten your comment to 2,000 characters or fewer."
        : draftError && !isFeedbackReady
          ? "Feedback is temporarily unavailable."
          : null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!snapshot || !canSendFeedback) {
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError(null);

      const submitted = await submitFeedbackAction(
        snapshot.applicationId,
        {
          rating: feedback.rating,
          comment: feedback.comment,
          context: buildFeedbackContext(),
        },
        getOrCreateTrackingSessionId(),
      );

      lastPersistedFeedbackRef.current = serializeFeedbackDraft({
        rating: submitted.rating,
        comment: submitted.comment,
      });
      setFeedback(submitted);
      setSaveState("idle");
      setDraftError(null);
    } catch {
      setSubmitError("Feedback couldn't be sent. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

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
            <SectionCard title={SUBMISSION_HEADLINE}>
              <div className="flex flex-col gap-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <CheckCircle2
                    className="h-10 w-10 text-[color:var(--accent)]"
                    aria-hidden
                  />
                  <div className="flex flex-col gap-1">
                    <p className="text-base font-semibold text-[color:var(--primary)]">
                      {NEXT_STEP_MESSAGE}
                    </p>
                    <p className="text-sm leading-6 text-[color:var(--foreground-soft)]">
                      Scan a QR code or use the open link for WeChat or WhatsApp
                      to connect with your consultant and continue follow-up.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-[color:var(--border)] bg-white p-5 sm:p-6">
                  <div className="grid gap-8 sm:grid-cols-2 sm:gap-6">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <p className="text-sm font-semibold text-[color:var(--primary)]">
                        WeChat
                      </p>
                      <div className="rounded-2xl border border-[color:var(--border)] bg-white p-3 shadow-[var(--shadow-card)]">
                        <QRCodeSVG
                          value={SUBMISSION_COMPLETE_WECHAT_URL}
                          size={200}
                          level="M"
                          marginSize={4}
                          title="WeChat QR code for adding the talent consultant"
                        />
                      </div>
                      <a
                        href={SUBMISSION_COMPLETE_WECHAT_URL}
                        className={QR_CONTACT_OPEN_LINK_CLASS_NAME}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MessageCircle
                          className="size-5 shrink-0"
                          aria-hidden
                        />
                        Open WeChat
                      </a>
                    </div>
                    <div className="flex flex-col items-center gap-3 text-center">
                      <p className="text-sm font-semibold text-[color:var(--primary)]">
                        WhatsApp
                      </p>
                      <div className="rounded-2xl border border-[color:var(--border)] bg-white p-3 shadow-[var(--shadow-card)]">
                        <QRCodeSVG
                          value={SUBMISSION_COMPLETE_WHATSAPP_URL}
                          size={200}
                          level="M"
                          marginSize={4}
                          title="WhatsApp QR code for contacting the overseas talent consultant"
                        />
                      </div>
                      <a
                        href={SUBMISSION_COMPLETE_WHATSAPP_URL}
                        className={QR_CONTACT_OPEN_LINK_CLASS_NAME}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MessageCircle
                          className="size-5 shrink-0"
                          aria-hidden
                        />
                        Open WhatsApp Chat
                      </a>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-3 border-t border-emerald-200/80 pt-6 text-center">
                  <p className="max-w-md text-sm leading-6 text-[color:var(--foreground-soft)]">
                    Need to add or replace supporting documents? Continue below
                    to update your materials.
                  </p>
                  <Link
                    href="/apply/supplement"
                    className={cn(
                      getButtonClassName("primary"),
                      "w-full max-w-xs sm:w-auto",
                    )}
                  >
                    Update materials
                  </Link>
                </div>
              </div>
            </SectionCard>
          ) : null}

          {!isLoading && !error && snapshot ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <SectionCard
                title={
                  isSubmitted
                    ? "Thanks for your feedback."
                    : FEEDBACK_HEADING_PRIMARY
                }
                description={
                  isSubmitted
                    ? "Your feedback was sent and will help us improve this experience."
                    : FEEDBACK_HEADING_SECONDARY
                }
                className="mx-auto max-w-[48rem] border-[color:var(--border)] bg-white shadow-none"
              >
                <div aria-live="polite" className="sr-only">
                  {liveMessage}
                </div>

                {draftError && !isFeedbackReady ? (
                  <div className="mb-4">
                    <StatusBanner
                      tone="neutral"
                      title="Feedback is temporarily unavailable"
                      description={draftError}
                    />
                  </div>
                ) : null}

                <AnimatePresence mode="wait" initial={false}>
                  {isFeedbackLoading ? (
                    <motion.div
                      key="loading-feedback"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                    >
                      <StatusBanner
                        tone="loading"
                        title="Loading feedback"
                        description="Restoring your saved feedback details."
                      />
                    </motion.div>
                  ) : !isFeedbackReady ? (
                    <motion.div
                      key="feedback-unavailable"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--muted)]/35 p-4 text-sm leading-6 text-[color:var(--foreground-soft)]"
                    >
                      You can still contact your consultant using the details
                      above. Feedback will become available again after you
                      refresh the page.
                    </motion.div>
                  ) : isSubmitted ? (
                    <motion.div
                      key="submitted-feedback"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="flex flex-col gap-4"
                    >
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950">
                        Thanks - your feedback was sent.
                      </div>
                      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--muted)]/20 p-4">
                        <div className="flex items-center gap-2">
                          <Clock3
                            className="h-4 w-4 text-[color:var(--primary)]"
                            aria-hidden
                          />
                          <p className="text-sm font-semibold text-[color:var(--primary)]">
                            Sent
                          </p>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[color:var(--foreground-soft)]">
                          {formatTimestamp(feedback.submittedAt) ??
                            "Your feedback was submitted successfully."}
                        </p>
                      </div>
                      {hasComment ? (
                        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--muted)]/20 p-4">
                          <div className="flex items-center gap-2">
                            <PencilLine
                              className="h-4 w-4 text-[color:var(--primary)]"
                              aria-hidden
                            />
                            <p className="text-sm font-semibold text-[color:var(--primary)]">
                              Your comment
                            </p>
                          </div>
                          <p className="mt-3 text-sm leading-6 whitespace-pre-wrap text-[color:var(--foreground-soft)]">
                            {feedback.comment}
                          </p>
                        </div>
                      ) : null}
                    </motion.div>
                  ) : (
                    <motion.form
                      key="editable-feedback"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="flex flex-col gap-5"
                      onSubmit={handleSubmit}
                    >
                      {submitError ? (
                        <StatusBanner
                          tone="danger"
                          title="Feedback couldn't be sent"
                          description={submitError}
                        />
                      ) : null}

                      {draftError &&
                      isFeedbackReady &&
                      saveState === "error" ? (
                        <StatusBanner
                          tone="neutral"
                          title="Draft couldn't be saved"
                          description="Draft couldn't be saved, but you can still send your feedback."
                        />
                      ) : null}

                      <div className="flex flex-col gap-2">
                        <label className="sr-only" htmlFor="feedback-comment">
                          Message
                        </label>
                        <textarea
                          id="feedback-comment"
                          className={getInputClassName(
                            cn(
                              "min-h-[120px] resize-y",
                              commentTooLong &&
                                "border-rose-400 focus-visible:ring-rose-200",
                            ),
                          )}
                          placeholder="Tell us what happened, what felt confusing, or what we could make better."
                          value={feedback.comment}
                          onChange={(event) => {
                            setSubmitError(null);
                            setFeedback((current) => ({
                              ...current,
                              comment: event.target.value,
                            }));
                          }}
                          aria-invalid={commentTooLong}
                          aria-describedby={
                            commentTooLong
                              ? "feedback-comment-too-long"
                              : undefined
                          }
                          disabled={isSubmitting}
                        />
                        {commentTooLong ? (
                          <p
                            id="feedback-comment-too-long"
                            className="text-sm font-medium text-rose-700"
                          >
                            Please shorten your comment to 2,000 characters or
                            fewer.
                          </p>
                        ) : null}
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
                        <button
                          type="submit"
                          className={cn(
                            "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-zinc-950 bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto",
                          )}
                          disabled={!canSendFeedback}
                        >
                          <Send className="h-4 w-4" aria-hidden />
                          {submitButtonLabel}
                        </button>
                        {!hasFeedbackContent ? (
                          <p className="pt-1 text-sm leading-6 text-[color:var(--foreground-soft)]">
                            Write a comment to send feedback.
                          </p>
                        ) : null}
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>
              </SectionCard>
            </motion.div>
          ) : null}

          {!isLoading && !error && snapshot ? (
            <p className="px-1 text-xs leading-6 text-[color:var(--foreground-soft)]">
              If you have any questions, please email us at{" "}
              <a
                className="font-medium text-[color:var(--primary)] underline underline-offset-2"
                href={`mailto:${SUBMISSION_COMPLETE_CONTACT_EMAIL}`}
              >
                {SUBMISSION_COMPLETE_CONTACT_EMAIL}
              </a>
              .
            </p>
          ) : null}
        </div>
      </PageShell>
    </PageFrame>
  );
}
