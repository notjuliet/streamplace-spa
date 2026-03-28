import { A } from "@solidjs/router";

import { LoginButton } from "./LoginButton";

export function Header() {
  return (
    <header class="border-sp-border flex items-center justify-between border-b px-4 py-3">
      <A href="/" class="flex items-center gap-2 text-lg font-medium tracking-tight">
        <svg viewBox="-2 -2 36 36" class="text-sp-accent h-7 w-7" aria-hidden="true">
          <circle cx="16" cy="16" r="15" fill="none" stroke="currentColor" stroke-opacity="0.15" stroke-width="3" />
          <circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" stroke-opacity="0.3" stroke-width="3" />
          <circle cx="16" cy="16" r="7.5" fill="currentColor" />
        </svg>
        <span>streamplace</span>
      </A>
      <LoginButton />
    </header>
  );
}
