const INVITE_TOKEN_PARAM_KEYS = ["t", "T", "token", ""] as const;

/**
 * Invite links may use `t`, `T`, `token`, or a malformed prefix like `?=value`
 * (empty query key), which URLSearchParams exposes as get("").
 */
export function readInviteTokenFromSearchParams(
  params: URLSearchParams,
): string | null {
  for (const key of INVITE_TOKEN_PARAM_KEYS) {
    const trimmed = params.get(key)?.trim();

    if (trimmed) {
      return trimmed;
    }
  }

  return null;
}

type NextSearchParamValue = string | string[] | undefined;

export function resolveInviteTokenFromNextSearchParams(
  sp: Record<string, NextSearchParamValue>,
): string | null {
  const pick = (key: string): string | null => {
    const value = sp[key];
    if (typeof value === "string") {
      const t = value.trim();
      return t.length > 0 ? t : null;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        const t = String(item).trim();
        if (t.length > 0) {
          return t;
        }
      }
    }
    return null;
  };

  for (const key of INVITE_TOKEN_PARAM_KEYS) {
    const token = pick(key);

    if (token) {
      return token;
    }
  }

  return null;
}

export function removeInviteTokenFromUrl(rawUrl: string): string {
  const url = new URL(rawUrl, "http://localhost");

  for (const key of INVITE_TOKEN_PARAM_KEYS) {
    url.searchParams.delete(key);
  }

  const search = url.searchParams.toString();

  return `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
}
