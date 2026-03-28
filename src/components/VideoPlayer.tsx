import { Maximize, Volume2, VolumeOff } from "lucide-solid";
import { createSignal, onCleanup, onMount, Show } from "solid-js";

import { fetchLiveUsers } from "../lib/api";
import { connectWhep, type WhepConnection } from "../lib/whep";

export interface VideoPlayerProps {
  handle: string;
}

export function VideoPlayer(props: VideoPlayerProps) {
  let videoEl!: HTMLVideoElement;
  let containerEl!: HTMLDivElement;
  let connection: WhepConnection | undefined;

  const [status, setStatus] = createSignal<"connecting" | "live" | "offline">("connecting");
  const [muted, setMuted] = createSignal(true);
  const [volume, setVolume] = createSignal(1);
  const [showControls, setShowControls] = createSignal(false);
  let controlsTimer: ReturnType<typeof setTimeout> | undefined;
  let pollTimer: ReturnType<typeof setInterval> | undefined;

  const flashControls = () => {
    setShowControls(true);
    clearTimeout(controlsTimer);
    controlsTimer = setTimeout(() => setShowControls(false), 3000);
  };

  const connect = async () => {
    try {
      connection = await connectWhep(props.handle);

      connection.pc.oniceconnectionstatechange = () => {
        const state = connection!.pc.iceConnectionState;
        if (state === "connected" || state === "completed") {
          setStatus("live");
        }
      };

      videoEl.srcObject = connection.stream;
      videoEl.play().catch(() => {});
    } catch {
      // poll will handle showing offline
    }
  };

  const disconnect = () => {
    if (connection) {
      connection.pc.close();
      connection = undefined;
    }
    videoEl.srcObject = null;
  };

  const poll = async () => {
    try {
      const liveUsers = await fetchLiveUsers();
      const isLive = liveUsers.some((u) => u.handle === props.handle);
      if (isLive && !connection) {
        setStatus("connecting");
        connect();
      } else if (!isLive && status() !== "offline") {
        disconnect();
        setStatus("offline");
      }
    } catch {
      // ignore, try again next poll
    }
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
    } else if (containerEl.requestFullscreen) {
      containerEl.requestFullscreen().catch(() => {});
    } else if ((videoEl as any).webkitEnterFullscreen) {
      (videoEl as any).webkitEnterFullscreen();
    }
  };

  const resumeOnPause = () => {
    if (status() === "live") videoEl.play().catch(() => {});
  };

  onMount(() => {
    videoEl.muted = true;
    videoEl.addEventListener("pause", resumeOnPause);
    poll();
    pollTimer = setInterval(poll, 10_000);
  });

  onCleanup(() => {
    disconnect();
    clearInterval(pollTimer);
    clearTimeout(controlsTimer);
    videoEl.removeEventListener("pause", resumeOnPause);
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
          <Show when={status() === "offline"}>
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
          class="h-1 w-20 appearance-none rounded-full bg-white/30 accent-white"
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
