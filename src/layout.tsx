import { type ParentProps, onMount } from "solid-js";

import { initAuth } from "./auth/session-manager";
import { Header } from "./components/Header";

export function Layout(props: ParentProps) {
  onMount(() => {
    initAuth().catch((err) => {
      console.warn("Auth init failed:", err);
    });
  });

  return (
    <div class="flex h-dvh flex-col">
      <Header />
      <main class="flex min-h-0 flex-1 flex-col">{props.children}</main>
    </div>
  );
}
