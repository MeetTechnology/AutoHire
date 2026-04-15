/**
 * Invite links may use `t`, `token`, or a malformed prefix like `?=value`
 * (empty query key), which URLSearchParams exposes as get("").
 */
export function readInviteTokenFromSearchParams(
  params: URLSearchParams,
): string | null {
  const raw =
    params.get("t") ?? params.get("token") ?? params.get("") ?? undefined;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
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

  return pick("t") ?? pick("token") ?? pick("");
}
