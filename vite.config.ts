import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import lucidePreprocess from "vite-plugin-lucide-preprocess";
import solidPlugin from "vite-plugin-solid";

import metadata from "./public/oauth-client-metadata.json";

const SERVER_HOST = "127.0.0.1";
const SERVER_PORT = 5173;

export default defineConfig({
  plugins: [
    lucidePreprocess(),
    tailwindcss(),
    solidPlugin(),
    {
      name: "oauth",
      config(_conf, { command }) {
        if (command === "build") {
          process.env.VITE_OAUTH_CLIENT_ID = metadata.client_id;
          process.env.VITE_OAUTH_REDIRECT_URL = metadata.redirect_uris[0];
        } else {
          const redirectUri = `http://${SERVER_HOST}:${SERVER_PORT}/`;

          const clientId =
            `http://localhost` +
            `?redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&scope=${encodeURIComponent(metadata.scope)}`;

          process.env.VITE_OAUTH_CLIENT_ID = clientId;
          process.env.VITE_OAUTH_REDIRECT_URL = redirectUri;
        }

        process.env.VITE_CLIENT_URI = metadata.client_uri;
        process.env.VITE_OAUTH_SCOPE = metadata.scope;
      },
    },
  ],
  server: {
    host: SERVER_HOST,
    port: SERVER_PORT,
  },
  build: {
    target: "esnext",
  },
});
