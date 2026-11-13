"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GoogleGenAI, type FunctionCall, type LiveServerMessage, type Session } from "@google/genai";
import { buildLiveConnectConfig } from "@/lib/ai/hvac-tools";
import type { ToolResponse } from "@/lib/ai/live-session-state";
import {
  INPUT_SAMPLE_RATE,
  OUTPUT_SAMPLE_RATE,
  PCM_CAPTURE_WORKLET,
  PcmDownsampler,
  arrayBufferToBase64,
  base64PcmToFloat32,
  pcmRateFromMime,
} from "@/lib/ai/audio";

export type LiveStatus = "idle" | "connecting" | "active" | "error";

export type LiveToolCall = { id?: string; name: string; args: Record<string, unknown> };
export type LiveToolHandler = (call: LiveToolCall) => ToolResponse | Promise<ToolResponse>;

export type LiveCaption = { id: number; role: "tech" | "ai"; text: string; final: boolean };

export type LiveSessionInfo = { sessionId: string | null; persistence: boolean; model: string };

type TokenResponse = LiveSessionInfo & { token: string; expiresAt: string };

const STREAM_FRAME_MS = 1_000;
const STREAM_FRAME = { maxWidth: 768, quality: 0.7 };
const SCAN_FRAME = { maxWidth: 1280, quality: 0.85 };
const MAX_RECONNECTS = 3;

const KICKOFF =
  "The technician just started a live service call. Greet them in one short sentence and ask them to point the camera at the equipment data plate.";
const SCAN_PROMPT =
  "[Technician tapped Scan Data Plate] The frame just sent is a high-resolution shot of the equipment data plate. Read it and call register_equipment_plate with exactly what is printed. If any field is unreadable, ask me to move closer or turn on the flashlight.";

class LiveError extends Error {}

type AudioContextCtor = typeof AudioContext;
type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext ?? null;
}

function newAudioContext(Ctor: AudioContextCtor, sampleRate?: number): AudioContext {
  if (sampleRate) {
    try {
      return new Ctor({ sampleRate });
    } catch {
      /* older Safari rejects options; playback buffers carry their own rate anyway */
    }
  }
  return new Ctor();
}

function mediaErrorMessage(e: unknown, device: "microphone" | "camera"): string {
  const name = e instanceof DOMException ? e.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return `${device === "camera" ? "Camera" : "Microphone"} permission was denied. Allow it in your browser's site settings, then try again.`;
    case "NotFoundError":
    case "OverconstrainedError":
      return `No ${device} was found on this device.`;
    case "NotSupportedError":
      return `This browser blocked ${device} access. Check the site's permissions (and that the page is on HTTPS), then try again.`;
    case "NotReadableError":
    case "AbortError":
      return `The ${device} is in use by another app. Close it and try again.`;
    default:
      return `Could not access the ${device}${e instanceof Error && e.message ? `: ${e.message}` : "."}`;
  }
}

/**
 * Full-duplex Gemini Live session: mic → 16 kHz PCM, rear camera → JPEG at 1 FPS,
 * model audio → gapless 24 kHz playback with barge-in, and function calls routed
 * to `onToolCall` with responses sent back automatically.
 */
export function useGeminiLiveSession({ onToolCall }: { onToolCall: LiveToolHandler }) {
  const [status, setStatus] = useState<LiveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [inputLevel, setInputLevel] = useState(0);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [captions, setCaptions] = useState<LiveCaption[]>([]);
  const [sessionInfo, setSessionInfo] = useState<LiveSessionInfo | null>(null);
  const [scanFlash, setScanFlash] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const connIdRef = useRef(0);
  const setupDoneRef = useRef(false);
  const kickedOffRef = useRef(false);
  const stoppingRef = useRef(false);
  const resumeHandleRef = useRef<string | null>(null);
  const reconnectsRef = useRef(0);
  const sessionIdRef = useRef<string | null>(null);
  const mutedRef = useRef(false);

  const micStreamRef = useRef<MediaStream | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const captureCtxRef = useRef<AudioContext | null>(null);
  const playCtxRef = useRef<AudioContext | null>(null);
  const outGainRef = useRef<GainNode | null>(null);
  const captureNodesRef = useRef<AudioNode[]>([]);
  const workletUrlRef = useRef<string | null>(null);
  const frameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sourcesRef = useRef(new Set<AudioBufferSourceNode>());
  const nextPlayTimeRef = useRef(0);
  const captionIdRef = useRef(0);

  const onToolCallRef = useRef(onToolCall);
  useEffect(() => {
    onToolCallRef.current = onToolCall;
  }, [onToolCall]);

  /* ------------------------------ playback ------------------------------ */

  const flushPlayback = useCallback(() => {
    for (const src of sourcesRef.current) {
      src.onended = null;
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
    }
    sourcesRef.current.clear();
    nextPlayTimeRef.current = 0;
    setAiSpeaking(false);
  }, []);

  const playChunk = useCallback((b64: string, mime?: string) => {
    const ctx = playCtxRef.current;
    const out = outGainRef.current;
    if (!ctx || !out) return;
    const samples = base64PcmToFloat32(b64);
    if (!samples.length) return;
    const buffer = ctx.createBuffer(1, samples.length, pcmRateFromMime(mime, OUTPUT_SAMPLE_RATE));
    buffer.getChannelData(0).set(samples);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(out);
    // Gapless: queue each chunk exactly where the previous one ends.
    const startAt = Math.max(nextPlayTimeRef.current, ctx.currentTime + 0.03);
    src.start(startAt);
    nextPlayTimeRef.current = startAt + buffer.duration;
    sourcesRef.current.add(src);
    setAiSpeaking(true);
    src.onended = () => {
      sourcesRef.current.delete(src);
      if (sourcesRef.current.size === 0) setAiSpeaking(false);
    };
  }, []);

  /* ------------------------------ captions ------------------------------ */

  const addCaption = useCallback((role: LiveCaption["role"], text: string) => {
    if (!text) return;
    setCaptions((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === role && !last.final) {
        return [...prev.slice(0, -1), { ...last, text: last.text + text }];
      }
      const closed = prev.map((c) => (c.final ? c : { ...c, final: true }));
      return [...closed, { id: captionIdRef.current++, role, text: text.trimStart(), final: false }].slice(-12);
    });
  }, []);

  /* ------------------------------ frames ------------------------------ */

  const captureFrame = useCallback((opts: { maxWidth: number; quality: number }): string | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth) return null;
    const scale = Math.min(1, opts.maxWidth / video.videoWidth);
    const w = Math.round(video.videoWidth * scale);
    const h = Math.round(video.videoHeight * scale);
    const canvas = (canvasRef.current ??= document.createElement("canvas"));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const g = canvas.getContext("2d");
    if (!g) return null;
    g.drawImage(video, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", opts.quality).split(",")[1] ?? null;
  }, []);

  const send = useCallback((fn: (s: Session) => void) => {
    const s = sessionRef.current;
    if (!s || !setupDoneRef.current) return false;
    try {
      fn(s);
      return true;
    } catch (e) {
      console.warn("[live] send failed", e);
      return false;
    }
  }, []);

  /* ------------------------------ teardown ------------------------------ */

  const teardown = useCallback(() => {
    connIdRef.current++; // invalidate callbacks from the old socket
    setupDoneRef.current = false;
    if (frameTimerRef.current) clearInterval(frameTimerRef.current);
    frameTimerRef.current = null;
    try {
      sessionRef.current?.close();
    } catch {
      /* ignore */
    }
    sessionRef.current = null;
    flushPlayback();

    for (const node of captureNodesRef.current) {
      if (node instanceof AudioWorkletNode) node.port.onmessage = null;
      if (node instanceof ScriptProcessorNode) node.onaudioprocess = null;
      try {
        node.disconnect();
      } catch {
        /* ignore */
      }
    }
    captureNodesRef.current = [];
    void captureCtxRef.current?.close().catch(() => {});
    void playCtxRef.current?.close().catch(() => {});
    captureCtxRef.current = null;
    playCtxRef.current = null;
    outGainRef.current = null;

    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    camStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    camStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (workletUrlRef.current) URL.revokeObjectURL(workletUrlRef.current);
    workletUrlRef.current = null;

    resumeHandleRef.current = null;
    reconnectsRef.current = 0;
    setInputLevel(0);
    setCameraActive(false);
    setTorchOn(false);
    setTorchSupported(false);
    setReconnecting(false);
  }, [flushPlayback]);

  const fail = useCallback(
    (message: string) => {
      stoppingRef.current = true;
      teardown();
      setError(message);
      setStatus("error");
    },
    [teardown],
  );

  /* ------------------------------ tool calls ------------------------------ */

  const handleToolCalls = useCallback(async (calls: FunctionCall[]) => {
    const connId = connIdRef.current;
    const functionResponses = await Promise.all(
      calls.map(async (fc) => {
        let response: ToolResponse;
        try {
          response = await onToolCallRef.current({ id: fc.id, name: fc.name ?? "", args: fc.args ?? {} });
        } catch (e) {
          response = { error: e instanceof Error ? e.message : "Tool execution failed" };
        }
        return { id: fc.id, name: fc.name, response };
      }),
    );
    if (connId !== connIdRef.current) return; // socket was replaced meanwhile
    try {
      sessionRef.current?.sendToolResponse({ functionResponses });
    } catch (e) {
      console.warn("[live] sendToolResponse failed", e);
    }
  }, []);

  /* ------------------------------ connection ------------------------------ */

  const connectRef = useRef<(handle: string | null) => Promise<void>>(async () => {});

  /**
   * Greet once per session. setupComplete can arrive before live.connect() resolves,
   * so this runs from both places and fires when the second precondition lands.
   */
  const maybeKickoff = useCallback(() => {
    if (kickedOffRef.current) return;
    const sent = send((s) => s.sendClientContent({ turns: [{ role: "user", parts: [{ text: KICKOFF }] }], turnComplete: true }));
    if (sent) kickedOffRef.current = true;
  }, [send]);

  const handleMessage = useCallback(
    (msg: LiveServerMessage) => {
      if (msg.setupComplete) {
        setupDoneRef.current = true;
        reconnectsRef.current = 0;
        setReconnecting(false);
        setStatus("active");
        maybeKickoff();
      }

      const sc = msg.serverContent;
      if (sc) {
        // Barge-in: the tech started talking, drop everything still queued.
        if (sc.interrupted) flushPlayback();
        for (const part of sc.modelTurn?.parts ?? []) {
          const d = part.inlineData;
          if (d?.data && d.mimeType?.startsWith("audio/")) playChunk(d.data, d.mimeType);
        }
        if (sc.inputTranscription?.text) addCaption("tech", sc.inputTranscription.text);
        if (sc.outputTranscription?.text) addCaption("ai", sc.outputTranscription.text);
        if (sc.turnComplete) setCaptions((prev) => prev.map((c) => (c.final ? c : { ...c, final: true })));
      }

      if (msg.toolCall?.functionCalls?.length) void handleToolCalls(msg.toolCall.functionCalls);

      const resume = msg.sessionResumptionUpdate;
      if (resume?.resumable && resume.newHandle) resumeHandleRef.current = resume.newHandle;
    },
    [addCaption, flushPlayback, handleToolCalls, maybeKickoff, playChunk],
  );

  const handleClose = useCallback(
    (e: CloseEvent) => {
      if (stoppingRef.current) return;
      setupDoneRef.current = false;
      sessionRef.current = null;
      const handle = resumeHandleRef.current;
      if (handle && reconnectsRef.current < MAX_RECONNECTS) {
        // Server rotated the connection (goAway / ~10 min limit) or the network blipped: resume.
        reconnectsRef.current++;
        setReconnecting(true);
        setStatus("connecting");
        connectRef.current(handle).catch((err) =>
          fail(err instanceof LiveError ? err.message : "Lost the live AI connection and could not resume."),
        );
        return;
      }
      fail(`The live AI session ended${e.reason ? `: ${e.reason}` : "."} Start a new session to continue.`);
    },
    [fail],
  );

  const connect = useCallback(
    async (handle: string | null) => {
      const res = await fetch("/api/live/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionIdRef.current }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<TokenResponse> & { error?: string };
      if (!res.ok || !data.token || !data.model) {
        throw new LiveError(data.error ?? `Could not start a live AI session (HTTP ${res.status}).`);
      }
      if (stoppingRef.current) return;
      sessionIdRef.current = data.sessionId ?? null;
      setSessionInfo({ sessionId: data.sessionId ?? null, persistence: Boolean(data.persistence), model: data.model });

      const ai = new GoogleGenAI({ apiKey: data.token, httpOptions: { apiVersion: "v1alpha" } });
      const connId = ++connIdRef.current;
      setupDoneRef.current = false;
      const session = await ai.live.connect({
        model: data.model,
        config: { ...buildLiveConnectConfig(), sessionResumption: handle ? { handle } : {} },
        callbacks: {
          onmessage: (m) => connId === connIdRef.current && handleMessage(m),
          onerror: (ev) => connId === connIdRef.current && console.warn("[live] socket error", ev.message),
          onclose: (ev) => connId === connIdRef.current && handleClose(ev),
        },
      });
      if (connId !== connIdRef.current || stoppingRef.current) {
        session.close();
        return;
      }
      sessionRef.current = session;
      maybeKickoff();
    },
    [handleClose, handleMessage, maybeKickoff],
  );
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  /* ------------------------------ mic pipeline ------------------------------ */

  const onPcm = useCallback(
    (pcm: ArrayBuffer, rms: number) => {
      if (mutedRef.current) return;
      setInputLevel(Math.min(1, rms * 5));
      send((s) => s.sendRealtimeInput({ audio: { data: arrayBufferToBase64(pcm), mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}` } }));
    },
    [send],
  );

  const startMicPipeline = useCallback(
    async (ctx: AudioContext, mic: MediaStream) => {
      const source = ctx.createMediaStreamSource(mic);
      // Zero-gain sink keeps the graph pulled without echoing the mic to the speaker.
      const sink = ctx.createGain();
      sink.gain.value = 0;
      sink.connect(ctx.destination);
      captureNodesRef.current.push(source, sink);

      if (ctx.audioWorklet) {
        try {
          const url = URL.createObjectURL(new Blob([PCM_CAPTURE_WORKLET], { type: "application/javascript" }));
          workletUrlRef.current = url;
          await ctx.audioWorklet.addModule(url);
          const node = new AudioWorkletNode(ctx, "pcm-capture");
          node.port.onmessage = (e: MessageEvent<{ pcm: ArrayBuffer; rms: number }>) => onPcm(e.data.pcm, e.data.rms);
          source.connect(node).connect(sink);
          captureNodesRef.current.push(node);
          return;
        } catch (e) {
          console.warn("[live] AudioWorklet unavailable, falling back to ScriptProcessorNode", e);
        }
      }
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      const ds = new PcmDownsampler(ctx.sampleRate, onPcm);
      proc.onaudioprocess = (e) => ds.push(e.inputBuffer.getChannelData(0));
      source.connect(proc).connect(sink);
      captureNodesRef.current.push(proc);
    },
    [onPcm],
  );

  /* ------------------------------ camera ------------------------------ */

  const startCamera = useCallback(async () => {
    let cam: MediaStream;
    try {
      cam = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
    } catch (e) {
      setCameraError(`${mediaErrorMessage(e, "camera")} Continuing voice-only.`);
      return;
    }
    if (stoppingRef.current) {
      cam.getTracks().forEach((t) => t.stop());
      return;
    }
    camStreamRef.current = cam;
    const video = videoRef.current;
    if (video) {
      video.srcObject = cam;
      video.muted = true;
      video.playsInline = true;
      await video.play().catch(() => {});
    }
    setCameraActive(true);
    const track = cam.getVideoTracks()[0];
    const checkTorch = () => {
      const caps = track?.getCapabilities?.() as TorchCapabilities | undefined;
      setTorchSupported(Boolean(caps?.torch));
    };
    checkTorch();
    // Some Android devices only report torch once the track is fully running.
    setTimeout(checkTorch, 600);
  }, []);

  /* ------------------------------ public API ------------------------------ */

  const start = useCallback(async () => {
    if (sessionRef.current || (status === "connecting" && !error)) return;
    stoppingRef.current = false;
    kickedOffRef.current = false;
    sessionIdRef.current = null;
    mutedRef.current = false;
    setMicMuted(false);
    setError(null);
    setCameraError(null);
    setCaptions([]);
    setSessionInfo(null);
    setStatus("connecting");

    const Ctor = audioContextCtor();
    if (!navigator.mediaDevices?.getUserMedia || !Ctor) {
      fail(
        window.isSecureContext
          ? "This browser can't capture audio and video. Use current Chrome, Safari or Edge, or switch to the Guided Simulator."
          : "Live mode needs a secure (HTTPS) connection to use the camera and microphone.",
      );
      return;
    }

    // Create audio contexts synchronously inside the tap so iOS lets them play.
    const playCtx = newAudioContext(Ctor, OUTPUT_SAMPLE_RATE);
    const captureCtx = newAudioContext(Ctor);
    playCtxRef.current = playCtx;
    captureCtxRef.current = captureCtx;
    const outGain = playCtx.createGain();
    outGain.connect(playCtx.destination);
    outGainRef.current = outGain;
    void playCtx.resume();
    void captureCtx.resume();

    try {
      let mic: MediaStream;
      try {
        mic = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: INPUT_SAMPLE_RATE,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (e) {
        throw new LiveError(mediaErrorMessage(e, "microphone"));
      }
      if (stoppingRef.current) {
        mic.getTracks().forEach((t) => t.stop());
        return;
      }
      micStreamRef.current = mic;

      await startCamera();
      await startMicPipeline(captureCtx, mic);
      await connect(null);
      if (stoppingRef.current) return;

      frameTimerRef.current = setInterval(() => {
        if (!camStreamRef.current) return;
        const frame = captureFrame(STREAM_FRAME);
        if (frame) send((s) => s.sendRealtimeInput({ video: { data: frame, mimeType: "image/jpeg" } }));
      }, STREAM_FRAME_MS);
    } catch (e) {
      if (stoppingRef.current) return;
      fail(e instanceof LiveError ? e.message : `Could not start the live session${e instanceof Error ? `: ${e.message}` : "."}`);
    }
  }, [captureFrame, connect, error, fail, send, startCamera, startMicPipeline, status]);

  const stop = useCallback(() => {
    stoppingRef.current = true;
    teardown();
    setStatus("idle");
  }, [teardown]);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMicMuted(next);
    micStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    if (next) {
      setInputLevel(0);
      // Let server-side VAD close the tech's turn instead of waiting on silence.
      send((s) => s.sendRealtimeInput({ audioStreamEnd: true }));
    }
  }, [send]);

  const toggleTorch = useCallback(async () => {
    const track = camStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
      setCameraError("This camera doesn't allow flashlight control from the browser.");
    }
  }, [torchOn]);

  /** Send an immediate high-res frame and ask the model to read the data plate. */
  const scanDataPlate = useCallback((): boolean => {
    const frame = captureFrame(SCAN_FRAME);
    if (!frame) return false;
    const sent = send((s) => {
      s.sendRealtimeInput({ video: { data: frame, mimeType: "image/jpeg" } });
      s.sendRealtimeInput({ text: SCAN_PROMPT });
    });
    if (sent) {
      setScanFlash(true);
      setTimeout(() => setScanFlash(false), 900);
    }
    return sent;
  }, [captureFrame, send]);

  useEffect(
    () => () => {
      stoppingRef.current = true;
      teardown();
    },
    [teardown],
  );

  return {
    status,
    error,
    cameraError,
    cameraActive,
    micMuted,
    torchSupported,
    torchOn,
    inputLevel,
    aiSpeaking,
    reconnecting,
    captions,
    sessionInfo,
    scanFlash,
    videoRef,
    start,
    stop,
    toggleMute,
    toggleTorch,
    scanDataPlate,
  };
}
