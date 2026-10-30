"use client";

import { useCallback, useRef, useState, type SetStateAction } from "react";

// Tab-scoped, short-lived drafts. Callers must omit passwords and PINs.
export function useSessionDraft<T>(key: string, initial: () => T, validate: (value: unknown) => value is T) {
  const initialRef = useRef(initial);
  // These sheets mount only after a client interaction. Restore synchronously
  // so a background tab cannot briefly reset the form before passive effects run.
  const [loaded] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = sessionStorage.getItem(key);
        const saved = raw ? JSON.parse(raw) : null;
        if (saved && typeof saved.savedAt === "number" && Date.now() - saved.savedAt < 24 * 3600000 && validate(saved.value)) {
          return { value: saved.value, restored: true };
        }
      } catch { /* Storage may be unavailable or contain an incomplete draft. */ }
    }
    return { value: initial(), restored: false };
  });
  const [value, setState] = useState(loaded.value);
  const valueRef = useRef(value);
  const [restored, setRestored] = useState(loaded.restored);

  const setValue = useCallback((update: SetStateAction<T>) => {
    const next = typeof update === "function" ? (update as (old: T) => T)(valueRef.current) : update;
    valueRef.current = next;
    setState(next);
    // Persist before a close/navigation can unmount the sheet.
    try { sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), value: next })); }
    catch { /* State still survives while the sheet remains mounted. */ }
  }, [key]);

  const clearDraft = useCallback(() => {
    try { sessionStorage.removeItem(key); } catch { /* Optional persistence. */ }
    setRestored(false);
  }, [key]);
  const resetDraft = useCallback(() => {
    valueRef.current = initialRef.current();
    setState(valueRef.current);
    clearDraft();
  }, [clearDraft]);

  return { value, setValue, restored, clearDraft, resetDraft };
}
