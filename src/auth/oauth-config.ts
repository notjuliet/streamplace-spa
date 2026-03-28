import { LocalActorResolver } from "@atcute/identity-resolver";
import { configureOAuth } from "@atcute/oauth-browser-client";

import { didDocumentResolver, handleResolver } from "../lib/api";

configureOAuth({
  metadata: {
    client_id: import.meta.env.VITE_OAUTH_CLIENT_ID,
    redirect_uri: import.meta.env.VITE_OAUTH_REDIRECT_URL,
  },
  identityResolver: new LocalActorResolver({
    handleResolver: handleResolver,
    didDocumentResolver: didDocumentResolver,
  }),
});
