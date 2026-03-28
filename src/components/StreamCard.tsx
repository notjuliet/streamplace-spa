import { A } from "@solidjs/router";

export interface StreamCardProps {
  handle: string;
  did: string;
  title: string;
  viewerCount: number;
  avatarUrl?: string;
  thumbRef?: string;
}

function getThumbnailUrl(handle: string): string {
  return `https://stream.place/api/playback/${encodeURIComponent(handle)}/stream.jpg?ts=${Date.now()}`;
}

export function StreamCard(props: StreamCardProps) {
  const thumbUrl = () => getThumbnailUrl(props.handle);

  return (
    <A
      href={`/${props.handle}`}
      class="group border-sp-border bg-sp-surface hover:border-sp-accent overflow-hidden rounded-lg border transition-colors"
    >
      <div class="bg-sp-bg aspect-video w-full overflow-hidden">
        {thumbUrl() ? (
          <img src={thumbUrl()} alt="" class="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div class="text-sp-dim flex h-full items-center justify-center">
            <span class="text-3xl">&#9654;</span>
          </div>
        )}
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
          <div class="text-sp-dim mt-1 flex items-center gap-1.5 text-xs">
            <span
              class="bg-sp-accent inline-block h-2 w-2 rounded-full"
              style={{ animation: "pulse-live 3s ease-in-out infinite" }}
            />
            {props.viewerCount} watching
          </div>
        </div>
      </div>
    </A>
  );
}
