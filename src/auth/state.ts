import { OAuthUserAgent } from "@atcute/oauth-browser-client";
import { createSignal } from "solid-js";

export const [agent, setAgent] = createSignal<OAuthUserAgent | undefined>();
export const [loggedInDid, setLoggedInDid] = createSignal<string | undefined>();
export const [loggedInHandle, setLoggedInHandle] = createSignal<string | undefined>();
