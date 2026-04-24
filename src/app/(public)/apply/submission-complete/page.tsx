"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  MessageCircle,
  PencilLine,
  Send,
  Star,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
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
  SUBMISSION_COMPLETE_WHATSAPP_URL,
} from "@/features/application/constants";
import {
  fetchApplicationFeedback,
  fetchSession,
  saveApplicationFeedbackDraft,
  submitApplicationFeedback,
} from "@/features/application/client";
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
import { trackPageView } from "@/lib/tracking/client";
import { cn } from "@/lib/utils";

const SUBMISSION_MESSAGE =
  "Application Received! We will review your package and contact you within 1 week.";
const NEXT_STEP_MESSAGE =
  "Next Step: Connect with your dedicated Talent Consultant.";

const FEEDBACK_TITLE = "How was your submission experience?";
const FEEDBACK_SUBTITLE =
  "Optional, takes about 30 seconds. Please don't include passwords or sensitive information.";

const RATING_VALUES = [1, 2, 3, 4, 5] as const;

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

function formatRelativeDraftSaved(value: string | null) {
  if (!value) {
    return "Draft saved automatically.";
  }

  const savedAt = new Date(value);

  if (Number.isNaN(savedAt.getTime())) {
    return "Draft saved automatically.";
  }

  const diffMs = Date.now() - savedAt.getTime();
  const diffSeconds = Math.max(0, Math.round(diffMs / 1000));

  if (diffSeconds < 10) {
    return "Draft saved just now.";
  }

  const relativeTime = new Intl.RelativeTimeFormat("en", {
    numeric: "auto",
  });

  if (diffSeconds < 60) {
    return `Draft saved ${relativeTime.format(-diffSeconds, "second")}.`;
  }

  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `Draft saved ${relativeTime.format(-diffMinutes, "minute")}.`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `Draft saved ${relativeTime.format(-diffHours, "hour")}.`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `Draft saved ${relativeTime.format(-diffDays, "day")}.`;
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
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const saveResetTimerRef = useRef<number | null>(null);
  const lastPersistedFeedbackRef = useRef(
    serializeFeedbackDraft({ rating: null, comment: "" }),
  );
  const hasTrackedViewRef = useRef(false);
  const ratingOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);

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
        return;
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }

      try {
        const nextFeedback = await fetchApplicationFeedback(
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
  const hasFeedbackContent = feedback.rating !== null || hasComment;
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

        const saved = await saveApplicationFeedbackDraft(snapshot.applicationId, {
          rating: feedback.rating,
          comment: feedback.comment,
          context: buildFeedbackContext(),
        });

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

  const remainingCharacters =
    APPLICATION_FEEDBACK_COMMENT_MAX_LENGTH - feedback.comment.length;
  const displayRemainingCharacters = Math.max(remainingCharacters, 0);
  const isSubmitted = feedback.status === "SUBMITTED";
  const canSendFeedback =
    isFeedbackReady &&
    hasFeedbackContent &&
    !commentTooLong &&
    !isSubmitting;
  const submitButtonLabel = isSubmitting
    ? "Sending..."
    : submitError
      ? "Try again"
      : "Send feedback";
  const showStatusRow = hasComment || commentTooLong || saveState === "error";
  const statusMessage = commentTooLong
    ? "Please shorten your comment to 2,000 characters or fewer."
    : saveState === "saving"
      ? "Saving draft..."
      : saveState === "error"
        ? "Draft couldn't be saved, but you can still send your feedback."
        : hasComment
          ? formatRelativeDraftSaved(feedback.draftSavedAt)
          : null;
  const statusTone = commentTooLong || saveState === "error" ? "danger" : "neutral";
  const liveMessage =
    isSubmitted
      ? "Thanks - your feedback was sent."
      : submitError
        ? "Feedback couldn't be sent. Please try again."
        : commentTooLong
          ? "Please shorten your comment to 2,000 characters or fewer."
          : saveState === "saving"
            ? "Saving draft."
            : saveState === "saved"
              ? formatRelativeDraftSaved(feedback.draftSavedAt)
              : draftError && !isFeedbackReady
                ? "Feedback is temporarily unavailable."
                : null;

  function handleRatingSelect(value: number) {
    setSubmitError(null);
    setFeedback((current) => ({
      ...current,
      rating: current.rating === value ? null : value,
    }));
  }

  function handleRatingKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    const lastIndex = RATING_VALUES.length - 1;
    let nextIndex: number | null = null;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = index === lastIndex ? 0 : index + 1;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = index === 0 ? lastIndex : index - 1;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = lastIndex;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextValue = RATING_VALUES[nextIndex];
    handleRatingSelect(nextValue);
    ratingOptionRefs.current[nextIndex]?.focus();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!snapshot || !canSendFeedback) {
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError(null);

      const submitted = await submitApplicationFeedback(snapshot.applicationId, {
        rating: feedback.rating,
        comment: feedback.comment,
        context: buildFeedbackContext(),
      });

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
            <SectionCard
              title="Application Received!"
              description={SUBMISSION_MESSAGE}
            >
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
                      Use the QR code to connect with your consultant and
                      continue the follow-up process.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-[color:var(--border)] bg-white p-5 sm:p-6">
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className="rounded-2xl border border-[color:var(--border)] bg-white p-3 shadow-[var(--shadow-card)]">
                      <QRCodeSVG
                        value={SUBMISSION_COMPLETE_WHATSAPP_URL}
                        size={248}
                        level="M"
                        marginSize={4}
                        title="WhatsApp QR code for contacting the overseas talent consultant"
                      />
                    </div>
                    <p className="text-sm font-medium text-[color:var(--foreground-soft)]">
                      Scan to add on WeChat or WhatsApp
                    </p>
                    <a
                      href={SUBMISSION_COMPLETE_WHATSAPP_URL}
                      className={`${getButtonClassName("success")} min-h-14 w-full text-base sm:w-auto sm:min-w-80`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle className="h-5 w-5" aria-hidden />
                      Open WhatsApp Chat
                    </a>
                  </div>
                </div>
              </div>
            </SectionCard>
          ) : null}

          {!isLoading && !error && snapshot ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <SectionCard
                title={isSubmitted ? "Thanks for your feedback." : FEEDBACK_TITLE}
                description={
                  isSubmitted
                    ? "Your feedback was sent and will help us improve this experience."
                    : FEEDBACK_SUBTITLE
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
                      className="space-y-4"
                    >
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950">
                        Thanks - your feedback was sent.
                      </div>
                      <div className="space-y-3">
                        {typeof feedback.rating === "number" ? (
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1" aria-label={`${feedback.rating} out of 5`}>
                              {RATING_VALUES.map((value) => (
                                <Star
                                  key={value}
                                  className={cn(
                                    "size-5",
                                    value <= (feedback.rating ?? 0)
                                      ? "fill-amber-400 text-amber-400"
                                      : "fill-transparent text-[color:var(--border-strong)]",
                                  )}
                                  aria-hidden
                                />
                              ))}
                            </div>
                            <p className="text-base font-semibold text-[color:var(--primary)]">
                              {feedback.rating}/5
                            </p>
                          </div>
                        ) : null}
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
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[color:var(--foreground-soft)]">
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
                      className="space-y-5"
                      onSubmit={handleSubmit}
                    >
                      {submitError ? (
                        <StatusBanner
                          tone="danger"
                          title="Feedback couldn't be sent"
                          description={submitError}
                        />
                      ) : null}

                      {draftError && isFeedbackReady && saveState === "error" ? (
                        <StatusBanner
                          tone="neutral"
                          title="Draft couldn't be saved"
                          description="Draft couldn't be saved, but you can still send your feedback."
                        />
                      ) : null}

                      <fieldset className="space-y-3">
                        <legend className="sr-only">Overall rating</legend>
                        <div
                          role="radiogroup"
                          aria-label="Overall rating"
                          className="flex items-center gap-2"
                        >
                          {RATING_VALUES.map((value, index) => {
                            const checked = feedback.rating === value;
                            const tabIndex =
                              feedback.rating === null
                                ? index === 0
                                  ? 0
                                  : -1
                                : checked
                                  ? 0
                                  : -1;

                            return (
                              <motion.button
                                key={value}
                                ref={(element) => {
                                  ratingOptionRefs.current[index] = element;
                                }}
                                type="button"
                                role="radio"
                                aria-checked={checked}
                                aria-label={`${value} out of 5`}
                                disabled={isSubmitting}
                                tabIndex={tabIndex}
                                whileHover={isSubmitting ? undefined : { y: -1 }}
                                whileTap={isSubmitting ? undefined : { scale: 0.98 }}
                                onClick={() => handleRatingSelect(value)}
                                onKeyDown={(event) => handleRatingKeyDown(event, index)}
                                className={cn(
                                  "rounded-md p-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
                                  checked
                                    ? "bg-amber-50"
                                    : "hover:bg-[color:var(--muted)]/40",
                                )}
                              >
                                <Star
                                  className={cn(
                                    "size-7",
                                    value <= (feedback.rating ?? 0)
                                      ? "fill-amber-400 text-amber-400"
                                      : "fill-transparent text-[color:var(--border-strong)]",
                                  )}
                                  aria-hidden
                                />
                              </motion.button>
                            );
                          })}
                          <p className="ml-1 text-sm font-semibold text-[color:var(--primary)]">
                            {feedback.rating ?? 0}/5
                          </p>
                        </div>
                      </fieldset>

                      <div className="space-y-2">
                        <label
                          className="text-sm font-semibold text-[color:var(--primary)]"
                          htmlFor="feedback-comment"
                        >
                          What worked well, or what could we improve?{" "}
                          <span className="text-[color:var(--foreground-soft)]">
                            · optional
                          </span>
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
                          aria-describedby="feedback-comment-help feedback-status"
                          disabled={isSubmitting}
                        />
                        <p
                          id="feedback-comment-help"
                          className="text-sm leading-6 text-[color:var(--foreground-soft)]"
                        >
                          Please don&apos;t include passwords, payment details, or
                          other sensitive information.
                        </p>
                      </div>

                      {showStatusRow ? (
                        <div
                          id="feedback-status"
                          className="flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between"
                        >
                          <p
                            className={cn(
                              statusTone === "danger"
                                ? "text-rose-700"
                                : "text-[color:var(--foreground-soft)]",
                            )}
                          >
                            {statusMessage}
                          </p>
                          {hasComment ? (
                            <p
                              className={cn(
                                "text-[color:var(--foreground-soft)]",
                                remainingCharacters < 200 && "font-medium text-amber-700",
                                commentTooLong && "font-medium text-rose-700",
                              )}
                            >
                              {displayRemainingCharacters.toLocaleString("en-US")} characters left
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
                        <button
                          type="submit"
                          className={`${getButtonClassName("secondary")} w-full sm:w-auto`}
                          disabled={!canSendFeedback}
                        >
                          <Send className="h-4 w-4" aria-hidden />
                          {submitButtonLabel}
                        </button>
                        {!hasFeedbackContent ? (
                          <p className="pt-1 text-sm leading-6 text-[color:var(--foreground-soft)]">
                            Choose a rating or write a comment to send feedback.
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
