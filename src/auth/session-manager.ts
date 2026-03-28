import { Client } from "@atcute/client";
import {
  finalizeAuthorization,
  getSession,
  OAuthUserAgent,
  type Session,
} from "@atcute/oauth-browser-client";

import { resolveDidDoc } from "../lib/api";
import { agent, setAgent, setLoggedInDid, setLoggedInHandle } from "./state";
import "./oauth-config";

const resolveOwnHandle = async (did: string): Promise<string | undefined> => {
  try {
    const doc = await resolveDidDoc(did);
    const alias = doc.alsoKnownAs?.find((a) => a.startsWith("at://"));
    return alias?.replace("at://", "");
  } catch {
    return undefined;
  }
};

export const initAuth = async (): Promise<void> => {
  const session = await (async (): Promise<Session | undefined> => {
    const params = new URLSearchParams(decodeURIComponent(location.hash.slice(1)));

    if (params.has("state") && (params.has("code") || params.has("error"))) {
      history.replaceState(null, "", location.pathname + location.search);

      const auth = await finalizeAuthorization(params);
      const did = auth.session.info.sub;

      localStorage.setItem("atproto_did", did);
      return auth.session;
    } else {
      const storedDid = localStorage.getItem("atproto_did");

      if (storedDid) {
        try {
          const session = await getSession(storedDid as `did:${string}:${string}`);
          const rpc = new Client({ handler: new OAuthUserAgent(session) });
          const res = await rpc.get("com.atproto.server.getSession");
          if (!res.ok) throw new Error("Session verification failed");
          return session;
        } catch (err) {
          console.warn("Failed to restore session:", err);
          return undefined;
        }
      }
    }
  })();

  if (session) {
    const did = session.info.sub;
    const oauthAgent = new OAuthUserAgent(session);
    setAgent(oauthAgent);
    setLoggedInDid(did);

    const handle = await resolveOwnHandle(did);
    if (handle) setLoggedInHandle(handle);
  }
};

export const signOut = async (): Promise<void> => {
  const currentAgent = agent();
  if (currentAgent) {
    try {
      await currentAgent.signOut();
    } catch {
      // ignore signout errors
    }
  }
  localStorage.removeItem("atproto_did");
  setAgent(undefined);
  setLoggedInDid(undefined);
  setLoggedInHandle(undefined);
};
