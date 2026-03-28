import { useParams } from "@solidjs/router";
import { createEffect, createResource, createSignal, onCleanup, Show } from "solid-js";

import { Chat } from "../components/Chat";
import { VideoPlayer } from "../components/VideoPlayer";
import { resolveHandle } from "../lib/api";
import type { StreamInfo } from "../lib/chat";

export function Watch() {
  const params = useParams<{ handle: string }>();

  const [streamerDid] = createResource(
    () => params.handle,
    async (handle) => {
      try {
        return await resolveHandle(handle);
      } catch (err) {
        console.error("Failed to resolve handle:", err);
        return undefined;
      }
    },
  );

  createEffect(() => {
    document.title = `@${params.handle} - streamplace`;
    onCleanup(() => {
      document.title = "streamplace";
    });
  });

  const [streamInfo, setStreamInfo] = createSignal<StreamInfo | undefined>();
  const [viewerCount, setViewerCount] = createSignal(0);

  return (
    <div class="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
      {/* Main content - video + info */}
      <div class="flex min-w-0 flex-1 flex-col pb-4">
        <VideoPlayer handle={params.handle} />

        {/* Stream info bar */}
        <div class="mt-3 flex items-start justify-between gap-4 px-4">
          <div class="min-w-0">
            <h1 class="truncate text-lg font-semibold">
              {streamInfo()?.title || `@${params.handle}`}
            </h1>
            <Show when={streamInfo()?.title}>
              <div class="text-sp-dim text-sm">@{params.handle}</div>
            </Show>
          </div>
          <div class="text-sp-dim flex shrink-0 items-center gap-2 text-base">
            <span class="bg-sp-accent inline-block h-2.5 w-2.5 rounded-full" />
            {viewerCount()} watching
          </div>
        </div>
      </div>

      {/* Chat sidebar */}
      <div class="flex min-h-0 w-full flex-1 flex-col lg:w-105 lg:flex-none">
        <Chat
          class="flex-1"
          handle={params.handle}
          streamerDid={streamerDid()}
          onStreamInfo={setStreamInfo}
          onViewerCount={setViewerCount}
        />
      </div>
    </div>
  );
}
