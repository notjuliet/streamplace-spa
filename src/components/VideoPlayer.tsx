import { Maximize, Volume2, VolumeOff } from "lucide-solid";
import { createSignal, onCleanup, onMount, Show } from "solid-js";

import { connectWhep, type WhepConnection } from "../lib/whep";

export interface VideoPlayerProps {
  handle: string;
}

export function VideoPlayer(props: VideoPlayerProps) {
  let videoEl!: HTMLVideoElement;
  let containerEl!: HTMLDivElement;
  let connection: WhepConnection | undefined;

  const [status, setStatus] = createSignal<"connecting" | "live" | "error" | "idle">("idle");
  const [muted, setMuted] = createSignal(true);
  const [volume, setVolume] = createSignal(1);
  const [errorMsg, setErrorMsg] = createSignal("");
  const [showControls, setShowControls] = createSignal(false);
  let controlsTimer: ReturnType<typeof setTimeout> | undefined;

  const flashControls = () => {
    setShowControls(true);
    clearTimeout(controlsTimer);
    controlsTimer = setTimeout(() => setShowControls(false), 3000);
  };

  const connect = async () => {
    setStatus("connecting");
    setErrorMsg("");

    try {
      connection = await connectWhep(props.handle);

      connection.pc.oniceconnectionstatechange = () => {
        const state = connection!.pc.iceConnectionState;
        if (state === "connected" || state === "completed") {
          setStatus("live");
        } else if (state === "failed" || state === "disconnected") {
          setStatus("error");
          setErrorMsg("Connection lost");
        }
      };

      connection.pc.onconnectionstatechange = () => {
        if (connection!.pc.connectionState === "failed") {
          setStatus("error");
          setErrorMsg("Connection failed");
        }
      };

      videoEl.srcObject = connection.stream;
      videoEl.play().catch(() => {});
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to connect");
    }
  };

  const disconnect = () => {
    if (connection) {
      connection.pc.close();
      connection = undefined;
    }
    videoEl.srcObject = null;
    setStatus("idle");
  };

  const toggleMute = () => {
    const next = !muted();
    setMuted(next);
    videoEl.muted = next;
  };

  const handleVolume = (v: number) => {
    setVolume(v);
    videoEl.volume = v * v;
    if (v > 0 && muted()) {
      setMuted(false);
      videoEl.muted = false;
    } else if (v === 0) {
      setMuted(true);
      videoEl.muted = true;
    }
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerEl.requestFullscreen().catch(() => {});
    }
  };

  onMount(() => {
    videoEl.muted = true;
    connect();
  });

  onCleanup(() => {
    disconnect();
    clearTimeout(controlsTimer);
  });

  return (
    <div
      ref={containerEl}
      class="group/player relative w-full overflow-hidden bg-black"
      onTouchEnd={flashControls}
    >
      <video ref={videoEl} class="aspect-video w-full" playsinline autoplay />

      {/* Status overlay */}
      <Show when={status() !== "live"}>
        <div class="absolute inset-0 flex items-center justify-center bg-black/60">
          <Show when={status() === "connecting"}>
            <div class="text-sp-dim flex items-center gap-2">
              <div class="border-sp-dim border-t-sp-accent h-5 w-5 animate-spin rounded-full border-2" />
              Connecting...
            </div>
          </Show>
          <Show when={status() === "error"}>
            <div class="text-center">
              <div class="text-sp-red">{errorMsg() || "Error"}</div>
              <button
                class="bg-sp-surface text-sp-text hover:bg-sp-border mt-2 rounded-sm px-3 py-1.5 text-sm transition-colors"
                onClick={connect}
              >
                Retry
              </button>
            </div>
          </Show>
          <Show when={status() === "idle"}>
            <div class="text-sp-dim">Stream offline</div>
          </Show>
        </div>
      </Show>

      {/* Controls */}
      <div
        class={`absolute right-0 bottom-0 left-0 flex items-center gap-2 bg-black/60 p-3 transition-opacity group-hover/player:opacity-100 ${showControls() ? "opacity-100" : "opacity-0"}`}
      >
        <Show when={status() === "live"}>
          <span class="bg-sp-accent mr-1 flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-xs font-medium text-black">
            LIVE
          </span>
        </Show>
        <div class="flex-1" />
        <button
          class="rounded-sm p-1.5 text-white/70 transition-colors hover:text-white"
          onClick={toggleMute}
          title={muted() ? "Unmute" : "Mute"}
        >
          {muted() ? <VolumeOff size={18} /> : <Volume2 size={18} />}
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={muted() ? 0 : volume()}
          onInput={(e) => handleVolume(parseFloat(e.currentTarget.value))}
          class="h-1 w-20 cursor-pointer appearance-none rounded-full bg-white/30 accent-white"
        />
        <button
          class="rounded-sm p-1.5 text-white/70 transition-colors hover:text-white"
          onClick={toggleFullscreen}
          title="Fullscreen"
        >
          <Maximize size={18} />
        </button>
      </div>
    </div>
  );
}
