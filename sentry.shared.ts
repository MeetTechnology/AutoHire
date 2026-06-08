/**
 * Shared Sentry helpers. DSN is read from env; leave empty to disable reporting.
 *
 * - Client bundle: set NEXT_PUBLIC_SENTRY_DSN
 * - Server / edge: SENTRY_DSN or NEXT_PUBLIC_SENTRY_DSN
 */
export function getSentryDsn(): string | undefined {
  const dsn =
    process.env.SENTRY_DSN?.trim() ||
    process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();

  return dsn || undefined;
}

export function getClientSentryDsn(): string | undefined {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  return dsn || undefined;
}

export function isSentryEnabled(): boolean {
  return Boolean(getSentryDsn());
}

export function getSharedSentryOptions() {
  const dsn = getSentryDsn();

  return {
    dsn,
    enabled: Boolean(dsn),
    tracesSampleRate: 1,
    enableLogs: true,
    sendDefaultPii: true,
  } as const;
}
