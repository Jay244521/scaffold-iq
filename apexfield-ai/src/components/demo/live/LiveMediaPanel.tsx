"use client";

import type { RefObject } from "react";
import { Camera, CameraOff, Flashlight, FlashlightOff, Loader2, Mic, MicOff, Play, ScanLine, Square } from "lucide-react";
import type { LiveCaption, LiveStatus } from "@/hooks/useGeminiLiveSession";

const METER_BARS = 18;
// Fixed per-bar shape so the meter reads as a waveform rather than a block.
const BAR_SHAPE = Array.from({ length: METER_BARS }, (_, i) => 0.45 + 0.55 * Math.abs(Math.sin(i * 1.7 + 0.4)));

export function LevelMeter({ level, muted, label }: { level: number; muted: boolean; label: string }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
      <div className="flex h-8 flex-1 items-center gap-[3px]" aria-hidden="true">
        {BAR_SHAPE.map((shape, i) => {
          const h = muted ? 0.08 : Math.max(0.08, Math.min(1, level * shape * 1.6));
          return (
            <span
              key={i}
              className={`flex-1 rounded-full transition-[height] duration-100 ${muted ? "bg-line-strong" : h > 0.6 ? "bg-gauge" : "bg-amber"}`}
              style={{ height: `${h * 100}%` }}
            />
          );
        })}
      </div>
    </div>
  );
}

function AiSpeakingWave() {
  return (
    <span className="flex h-4 items-center gap-[2px]" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="animate-wave h-full w-[3px] rounded-full bg-amber" style={{ animationDelay: `${i * 0.12}s` }} />
      ))}
    </span>
  );
}

type Props = {
  videoRef: RefObject<HTMLVideoElement | null>;
  status: LiveStatus;
  reconnecting: boolean;
  cameraActive: boolean;
  cameraError: string | null;
  micMuted: boolean;
  inputLevel: number;
  aiSpeaking: boolean;
  torchSupported: boolean;
  torchOn: boolean;
  scanFlash: boolean;
  captions: LiveCaption[];
  equipmentLabel: string | null;
  onStart: () => void;
  onStop: () => void;
  onScan: () => void;
  onToggleMute: () => void;
  onToggleTorch: () => void;
};

export function LiveMediaPanel(p: Props) {
  const live = p.status === "active";
  const busy = p.status === "connecting";
  const idle = p.status === "idle" || p.status === "error";

  return (
    <section aria-label="Live camera and voice" className="flex flex-col gap-4">
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-line bg-black sm:aspect-[4/3]">
        <video
          ref={p.videoRef}
          className={`h-full w-full object-cover transition-opacity ${p.cameraActive ? "opacity-100" : "opacity-0"}`}
          muted
          playsInline
          autoPlay
          aria-label="Rear camera preview"
        />

        {/* corner brackets */}
        {p.cameraActive && (
          <div className="pointer-events-none absolute inset-6 sm:inset-10" aria-hidden="true">
            {["left-0 top-0 border-l-2 border-t-2", "right-0 top-0 border-r-2 border-t-2", "bottom-0 left-0 border-b-2 border-l-2", "bottom-0 right-0 border-b-2 border-r-2"].map((c) => (
              <span key={c} className={`absolute h-8 w-8 rounded-sm border-amber/80 ${c}`} />
            ))}
          </div>
        )}
        {p.scanFlash && <div className="pointer-events-none absolute inset-0 bg-white/30" aria-hidden="true" />}

        {/* top status row */}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent p-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] font-bold tracking-wider ${
              live ? "bg-danger/90 text-white" : busy ? "bg-amber/90 text-slate-deep" : "bg-black/60 text-muted"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${live ? "animate-pulse bg-white" : busy ? "bg-slate-deep" : "bg-muted"}`} />
            {live ? "LIVE · 1 FPS" : busy ? (p.reconnecting ? "RESUMING" : "CONNECTING") : "OFFLINE"}
          </span>
          {p.equipmentLabel && (
            <span className="max-w-[60%] truncate rounded-full bg-black/60 px-2.5 py-1 font-mono text-[11px] text-amber-hi">{p.equipmentLabel}</span>
          )}
        </div>

        {/* idle / connecting overlay */}
        {!p.cameraActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
            {busy ? (
              <>
                <Loader2 className="h-10 w-10 animate-spin text-amber" aria-hidden="true" />
                <p className="text-sm text-slate-300">{p.reconnecting ? "Resuming the AI session…" : "Allow camera and microphone access…"}</p>
              </>
            ) : live ? (
              <>
                <CameraOff className="h-10 w-10 text-muted" aria-hidden="true" />
                <p className="max-w-xs text-sm text-slate-300">Voice-only session. ApexField can hear you but can&apos;t see the unit.</p>
              </>
            ) : (
              <>
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber/15 text-amber">
                  <Camera className="h-8 w-8" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-lg font-bold">Point. Talk. Fix it right.</p>
                  <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
                    Uses your rear camera and mic. Earbuds recommended. Audio and 1 FPS video stream to Google Gemini only while the session is live.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={p.onStart}
                  className="inline-flex min-h-13 items-center gap-2 rounded-xl bg-amber px-7 py-3 text-base font-bold text-slate-deep shadow-[0_8px_30px_-8px_rgba(245,158,11,0.6)] transition-colors hover:bg-amber-hi"
                >
                  <Play className="h-5 w-5" aria-hidden="true" /> Start Live Session
                </button>
              </>
            )}
          </div>
        )}

        {/* bottom: AI caption */}
        {live && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-3 pt-10">
            <LatestCaption captions={p.captions} aiSpeaking={p.aiSpeaking} />
          </div>
        )}
      </div>

      {p.cameraError && (
        <p role="status" className="rounded-xl border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-amber-hi">
          {p.cameraError}
        </p>
      )}

      {/* controls */}
      <div className="rounded-2xl border border-line bg-steel p-4">
        <button
          type="button"
          onClick={p.onScan}
          disabled={!live || !p.cameraActive}
          className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-amber px-6 text-base font-bold text-slate-deep transition-colors hover:bg-amber-hi disabled:cursor-not-allowed disabled:bg-line-strong disabled:text-muted"
        >
          <ScanLine className="h-5 w-5" aria-hidden="true" /> Scan Data Plate
        </button>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <ControlButton
            onClick={p.onToggleMute}
            disabled={idle}
            pressed={p.micMuted}
            label={p.micMuted ? "Unmute" : "Mute"}
            icon={p.micMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            tone={p.micMuted ? "danger" : "default"}
          />
          <ControlButton
            onClick={p.onToggleTorch}
            disabled={!p.cameraActive || !p.torchSupported}
            pressed={p.torchOn}
            label={p.torchSupported || !p.cameraActive ? (p.torchOn ? "Light off" : "Flashlight") : "No torch"}
            icon={p.torchOn ? <Flashlight className="h-5 w-5" /> : <FlashlightOff className="h-5 w-5" />}
            tone={p.torchOn ? "amber" : "default"}
          />
          <ControlButton onClick={p.onStop} disabled={idle} label="End" icon={<Square className="h-5 w-5" />} tone="default" />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <span className="w-16 shrink-0 font-mono text-[10px] tracking-[0.1em] text-muted">{p.micMuted ? "MIC OFF" : "YOUR MIC"}</span>
          <LevelMeter level={p.inputLevel} muted={p.micMuted || !live} label="Microphone level" />
        </div>
      </div>
    </section>
  );
}

function ControlButton({
  onClick,
  disabled,
  pressed,
  label,
  icon,
  tone,
}: {
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  label: string;
  icon: React.ReactNode;
  tone: "default" | "danger" | "amber";
}) {
  const toneCls =
    tone === "danger" ? "border-danger/60 bg-danger/15 text-danger" : tone === "amber" ? "border-amber/60 bg-amber/15 text-amber" : "border-line-strong bg-slate-deep text-ink hover:border-amber hover:text-amber";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${toneCls}`}
    >
      <span aria-hidden="true">{icon}</span>
      {label}
    </button>
  );
}

function LatestCaption({ captions, aiSpeaking }: { captions: LiveCaption[]; aiSpeaking: boolean }) {
  const last = captions[captions.length - 1];
  return (
    <div aria-live="polite" className="flex items-end gap-2">
      <span className="mb-0.5 shrink-0">{aiSpeaking ? <AiSpeakingWave /> : <Mic className="h-4 w-4 text-muted" aria-hidden="true" />}</span>
      <p className="line-clamp-3 text-[15px] font-medium leading-snug text-white">
        {last ? (
          <>
            <span className={`mr-1.5 font-mono text-[10px] font-bold tracking-wider ${last.role === "ai" ? "text-amber" : "text-sky-300"}`}>
              {last.role === "ai" ? "APEX" : "YOU"}
            </span>
            {last.text}
          </>
        ) : (
          <span className="text-slate-300">Listening… just talk, no button needed.</span>
        )}
      </p>
    </div>
  );
}
