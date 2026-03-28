import { For, onCleanup, onMount, Show } from "solid-js";
import { createStore, reconcile } from "solid-js/store";

import { StreamCard } from "../components/StreamCard";
import { fetchLiveUsers, type LiveUser } from "../lib/api";

const POLL_INTERVAL = 15_000;

const avatarCache: Record<string, string> = {};

async function fetchNewAvatars(handles: string[]): Promise<void> {
  const missing = handles.filter((h) => !(h in avatarCache));
  if (!missing.length) return;
  try {
    const params = missing.map((h) => `actors=${encodeURIComponent(h)}`).join("&");
    const res = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfiles?${params}`,
    );
    if (!res.ok) return;
    const data = await res.json();
    for (const profile of data.profiles || []) {
      if (profile.avatar) {
        avatarCache[profile.handle] = profile.avatar;
      }
    }
  } catch {
    // ignore
  }
}

interface StreamEntry extends LiveUser {
  avatarUrl?: string;
}

export function Home() {
  const [streams, setStreams] = createStore<StreamEntry[]>([]);
  const [state, setState] = createStore({ loading: true });

  const refresh = async () => {
    try {
      const users = await fetchLiveUsers();
      users.sort((a, b) => (b.viewerCount ?? 0) - (a.viewerCount ?? 0));

      const handles = users.map((s) => s.handle).filter(Boolean);
      await fetchNewAvatars(handles);

      const entries: StreamEntry[] = users.map((s) => ({
        ...s,
        avatarUrl: avatarCache[s.handle],
      }));

      setStreams(reconcile(entries, { key: "did", merge: false }));
    } catch (err) {
      console.error("Failed to fetch streams:", err);
    } finally {
      setState("loading", false);
    }
  };

  onMount(() => {
    refresh();
  });

  const interval = setInterval(refresh, POLL_INTERVAL);
  onCleanup(() => clearInterval(interval));

  return (
    <div class="mx-auto w-full max-w-6xl p-6">
      <Show
        when={!state.loading}
        fallback={
          <div class="text-sp-dim flex items-center gap-2">
            <div class="border-sp-dim border-t-sp-accent h-4 w-4 animate-spin rounded-full border-2" />
            Loading streams...
          </div>
        }
      >
        <Show
          when={streams.length > 0}
          fallback={<p class="text-sp-dim">No one is live right now. Check back later!</p>}
        >
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <For each={streams}>
              {(stream) => (
                <StreamCard
                  handle={stream.handle}
                  did={stream.did}
                  title={stream.title}
                  viewerCount={stream.viewerCount}
                  avatarUrl={stream.avatarUrl}
                  thumbRef={stream.thumbRef}
                />
              )}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  );
}
