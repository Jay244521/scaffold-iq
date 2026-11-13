"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Turns field shorthand into words a speech engine reads naturally. */
function toSpeakable(text: string): string {
  return text
    .replace(/µF/g, " microfarads")
    .replace(/°F/g, " degrees")
    .replace(/in\. w\.c\./g, "inches of water column")
    .replace(/\bPSI\b/g, "P S I")
    .replace(/\bRLA\b/g, "R L A")
    .replace(/\bLRA\b/g, "L R A")
    .replace(/\bTXV\b/g, "T X V")
    .replace(/±/g, " plus or minus ")
    .replace(/→/g, ", ");
}

/**
 * Web Speech API wrapper. All window access happens inside effects or
 * event handlers so server and first client render match (no hydration drift).
 */
export function useSpeech() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const enabledRef = useRef(false);

  useEffect(() => {
    const ok = typeof window !== "undefined" && "speechSynthesis" in window;
    setSupported(ok);
    if (ok) window.speechSynthesis.getVoices(); // warms the voice list in Chrome
    return () => {
      if (ok) window.speechSynthesis.cancel();
    };
  }, []);

  const speak = useCallback((text: string, force = false) => {
    if (!force && !enabledRef.current) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(toSpeakable(text));
    u.rate = 1.03;
    u.pitch = 0.95;
    const voice =
      synth.getVoices().find((v) => v.lang === "en-US" && /Google|Natural|Samantha|Alex/i.test(v.name)) ??
      synth.getVoices().find((v) => v.lang.startsWith("en"));
    if (voice) u.voice = voice;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    synth.speak(u);
  }, []);

  const stop = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const toggle = useCallback(
    (currentText: string) => {
      const next = !enabledRef.current;
      enabledRef.current = next;
      setEnabled(next);
      if (next) speak(currentText, true);
      else stop();
    },
    [speak, stop]
  );

  return { supported, enabled, speaking, speak, stop, toggle };
}
