import { A } from "@solidjs/router";
import { createSignal, onCleanup } from "solid-js";

export interface StreamCardProps {
  handle: string;
  did: string;
  title: string;
  viewerCount: number;
  avatarUrl?: string;
  thumbRef?: string;
}

export function StreamCard(props: StreamCardProps) {
  const [ts, setTs] = createSignal(Date.now());
  const interval = setInterval(() => setTs(Date.now()), 15_000);
  onCleanup(() => clearInterval(interval));

  const thumbUrl = () =>
    `https://stream.place/api/playback/${encodeURIComponent(props.handle)}/stream.jpg?ts=${ts()}`;

  return (
    <A
      href={`/${props.handle}`}
      class="group border-sp-border bg-sp-surface hover:border-sp-accent overflow-hidden rounded-lg border transition-colors"
    >
      <div class="bg-sp-bg relative aspect-video w-full overflow-hidden">
        {thumbUrl() ? (
          <img src={thumbUrl()} alt="" class="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div class="flex h-full items-center justify-center">
            <img src="/favicon.svg" alt="" class="h-10 w-10 opacity-50" />
          </div>
        )}
        <div class="absolute bottom-3 left-3 flex items-center gap-1.5 rounded bg-black/70 px-2 py-1 text-xs text-white backdrop-blur-sm">
          <span
            class="bg-sp-accent inline-block h-2 w-2 rounded-full"
            style={{ animation: "pulse-live 3s ease-in-out infinite" }}
          />
          {props.viewerCount}
        </div>
      </div>
      <div class="group-hover:bg-sp-accent/10 flex gap-3 p-3 transition-colors">
        {props.avatarUrl ? (
          <img src={props.avatarUrl} alt="" class="h-9 w-9 shrink-0 rounded-full" loading="lazy" />
        ) : (
          <div class="bg-sp-border h-9 w-9 shrink-0 rounded-full" />
        )}
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-medium">{props.title}</div>
          <div class="text-sp-dim truncate text-xs">@{props.handle}</div>
        </div>
      </div>
    </A>
  );
}
