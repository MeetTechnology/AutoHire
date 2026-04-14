"use client";

export type StoredDraft<T> = {
  values: T;
  savedAt: string;
};

function isBrowser() {
  return typeof window !== "undefined";
}

export function readDraft<T>(key: string): StoredDraft<T> | null {
  if (!isBrowser()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as StoredDraft<T>;

    if (!parsed || typeof parsed !== "object" || !("values" in parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function writeDraft<T>(key: string, values: T) {
  if (!isBrowser()) {
    return null;
  }

  const savedAt = new Date().toISOString();

  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        values,
        savedAt,
      } satisfies StoredDraft<T>),
    );

    return savedAt;
  } catch {
    return null;
  }
}

export function clearDraft(key: string) {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage cleanup failures in client-only draft handling.
  }
}
