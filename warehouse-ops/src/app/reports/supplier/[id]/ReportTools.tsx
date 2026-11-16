"use client";

import { useState } from "react";
import { Check, Copy, Printer } from "lucide-react";
import { buttonClass } from "@/components/ui";

/** Editable draft message plus copy / print buttons. Nothing is ever sent from the app. */
export function DraftMessage({ initial }: { initial: string }) {
  const [text, setText] = useState(initial);
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <label htmlFor="draft" className="label print:hidden">Draft message (edit before sending)</label>
      <textarea
        id="draft"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setCopied(false);
        }}
        rows={14}
        className="input font-mono !text-sm print:hidden"
      />
      <div className="hidden whitespace-pre-wrap text-sm print:block">{text}</div>
      <div className="mt-2 flex flex-wrap gap-2 print:hidden">
        <button
          type="button"
          className={buttonClass("secondary", "sm")}
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
          }}
        >
          {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />} {copied ? "Copied" : "Copy message"}
        </button>
      </div>
    </div>
  );
}

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass("primary")}>
      <Printer className="h-4 w-4" aria-hidden /> Print / save as PDF
    </button>
  );
}
