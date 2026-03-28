import { Show, createEffect, createSignal, onCleanup } from "solid-js";

import { signIn } from "../auth/login";
import { showLoginModal, setShowLoginModal } from "../auth/login-modal";
import { signOut } from "../auth/session-manager";
import { agent, loggedInHandle } from "../auth/state";

export function LoginButton() {
  const [handle, setHandle] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  const handleSignIn = async () => {
    const h = handle().trim();
    if (!h) return;
    setLoading(true);
    try {
      await signIn(h);
    } catch (err) {
      console.error("Sign in failed:", err);
      setLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") handleSignIn();
  };

  createEffect(() => {
    if (!showLoginModal()) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowLoginModal(false);
    };
    document.addEventListener("keydown", onEsc);
    onCleanup(() => document.removeEventListener("keydown", onEsc));
  });

  return (
    <div class="flex items-center gap-3">
      <Show
        when={agent()}
        fallback={
          <>
            <button
              class="bg-sp-accent text-sp-bg hover:bg-sp-accent/80 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors"
              onClick={() => setShowLoginModal(true)}
            >
              Sign in
            </button>
            <Show when={showLoginModal()}>
              <div
                class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setShowLoginModal(false);
                }}
              >
                <div class="bg-sp-surface border-sp-border mx-4 flex w-full max-w-md flex-col gap-4 rounded-lg border p-5 shadow-lg">
                  <h2 class="text-sp-text text-lg font-semibold">Sign in</h2>
                  <input
                    type="text"
                    placeholder="handle.bsky.social"
                    class="border-sp-border bg-sp-bg text-sp-text placeholder:text-sp-dim focus:border-sp-accent rounded-sm border px-3 py-1.5 text-sm focus:outline-none"
                    value={handle()}
                    onInput={(e) => setHandle(e.currentTarget.value)}
                    onKeyDown={handleKeyDown}
                    ref={(el: HTMLInputElement) => setTimeout(() => el.focus())}
                  />
                  <div class="flex justify-end gap-2">
                    <button
                      class="text-sp-dim hover:text-sp-text rounded-sm px-3 py-1.5 text-sm transition-colors"
                      onClick={() => setShowLoginModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      class="bg-sp-accent text-sp-bg hover:bg-sp-accent/80 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
                      onClick={handleSignIn}
                      disabled={loading() || !handle().trim()}
                    >
                      {loading() ? "..." : "Go"}
                    </button>
                  </div>
                </div>
              </div>
            </Show>
          </>
        }
      >
        <span class="text-sp-dim hidden text-sm sm:inline">@{loggedInHandle() || "..."}</span>
        <button
          class="border-sp-border text-sp-dim hover:border-sp-red hover:text-sp-red rounded-sm border px-3 py-1.5 text-sm transition-colors"
          onClick={() => signOut()}
        >
          Sign out
        </button>
      </Show>
    </div>
  );
}
