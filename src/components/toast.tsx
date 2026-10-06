"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

const ToastContext = createContext<(msg: string) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

/** Ink fill, white text. Bottom centre on mobile, bottom right on desktop. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState("");
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((m: string) => {
    clearTimeout(t.current);
    setMsg(m);
    t.current = setTimeout(() => setMsg(""), 3500);
  }, []);
  useEffect(() => () => clearTimeout(t.current), []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[120] flex justify-center sm:inset-x-auto sm:bottom-6 sm:right-6"
      >
        {msg ? (
          <div className="animate-rise-in pointer-events-auto max-w-[calc(100vw-32px)] rounded-[6px] bg-ink px-4 py-3 text-sm leading-5 text-white shadow-[var(--shadow-toast)] sm:max-w-md">
            {msg}
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}
