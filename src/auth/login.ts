import { createAuthorizationUrl } from "@atcute/oauth-browser-client";

import "./oauth-config";

export const signIn = async (handle: string): Promise<void> => {
  const authUrl = await createAuthorizationUrl({
    scope: import.meta.env.VITE_OAUTH_SCOPE,
    target: { type: "account", identifier: handle as `${string}.${string}` },
  });

  location.assign(authUrl);
};
