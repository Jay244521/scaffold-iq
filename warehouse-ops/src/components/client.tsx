"use client";

import { useFormStatus } from "react-dom";
import { startTransition, useActionState, useEffect, useState, type ComponentProps, type FormEvent } from "react";
import { buttonClass, type ButtonVariant } from "@/components/ui";

/** Submit button that disables itself and shows progress while the form is submitting. */
export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  size = "md",
  className,
  pending: pendingProp,
  ...props
}: ComponentProps<"button"> & { pendingText?: string; variant?: ButtonVariant; size?: "sm" | "md" | "lg"; pending?: boolean }) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <button type="submit" disabled={pending || props.disabled} aria-busy={pending} className={buttonClass(variant, size, className)} {...props}>
      {pending ? (pendingText ?? "Saving…") : children}
    </button>
  );
}

/** Renders a timestamp in the viewer's own time zone (server renders in UTC). */
export function LocalTime({ value, mode = "datetime" }: { value: string | null; mode?: "datetime" | "date" | "relative" }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!value) return;
    const d = new Date(value);
    if (mode === "date") setText(d.toLocaleDateString(undefined, { dateStyle: "medium" }));
    else if (mode === "relative") setText(relative(d));
    else setText(d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }));
  }, [value, mode]);
  if (!value) return <span>—</span>;
  return (
    <time dateTime={value} title={value} suppressHydrationWarning>
      {text ?? new Date(value).toISOString().slice(0, 16).replace("T", " ") + " UTC"}
    </time>
  );
}

function relative(d: Date) {
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

/** A <select> that submits its form as soon as the value changes (e.g. facility switcher). */
export function AutoSubmitSelect(props: ComponentProps<"select">) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}

/**
 * Like useActionState, but submits via onSubmit so React does not reset the form
 * afterwards. (React 19 resets <form action> forms after every submission, which
 * wipes what the user typed when validation fails and can desync controlled selects.)
 */
export function useFormAction<S extends object>(action: (state: Awaited<S>, formData: FormData) => Promise<S>, initial: Awaited<S>) {
  const [state, dispatch, pending] = useActionState<S, FormData>(action, initial);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  };
  return [state, onSubmit, pending] as const;
}
