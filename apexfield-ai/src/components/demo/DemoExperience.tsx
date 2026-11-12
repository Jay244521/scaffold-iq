"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { DemoSimulator } from "./DemoSimulator";
import { ModeSwitch, type DemoMode } from "./ModeSwitch";

// The Gemini SDK only loads when someone actually picks Live mode.
const LiveSession = dynamic(() => import("./live/LiveSession").then((m) => m.LiveSession), {
  ssr: false,
  loading: () => <div className="min-h-screen" />,
});

/**
 * /demo shell: live Gemini coaching on phones with a camera, guided simulator elsewhere.
 * `?mode=live` or `?mode=sim` forces a mode (handy for sharing links).
 */
export function DemoExperience() {
  const [mode, setMode] = useState<DemoMode>("sim");

  useEffect(() => {
    const forced = new URLSearchParams(window.location.search).get("mode");
    if (forced === "live" || forced === "sim") {
      setMode(forced);
      return;
    }
    const touch = window.matchMedia("(pointer: coarse)").matches;
    if (touch && typeof navigator.mediaDevices?.getUserMedia === "function") setMode("live");
  }, []);

  const change = useCallback((m: DemoMode) => {
    setMode(m);
    const url = new URL(window.location.href);
    url.searchParams.set("mode", m);
    window.history.replaceState(null, "", url);
  }, []);

  const switcher = <ModeSwitch mode={mode} onChange={change} />;
  return mode === "live" ? (
    <LiveSession modeSwitch={switcher} onUseSimulator={() => change("sim")} />
  ) : (
    <DemoSimulator modeSwitch={switcher} />
  );
}
