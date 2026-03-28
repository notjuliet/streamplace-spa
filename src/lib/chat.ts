import { Client } from "@atcute/client";
import { OAuthUserAgent } from "@atcute/oauth-browser-client";

export interface Facet {
  index: { byteStart: number; byteEnd: number };
  features: Array<
    | { $type: "app.bsky.richtext.facet#mention"; did: string }
    | { $type: "app.bsky.richtext.facet#link"; uri: string }
  >;
}

export interface ChatMessage {
  uri: string;
  cid: string;
  author: { handle: string; did: string };
  record: {
    text: string;
    facets?: Facet[];
    reply?: { parent?: { uri: string; cid: string }; root?: { uri: string; cid: string } };
  };
  chatProfile?: { color?: { red: number; green: number; blue: number } };
  indexedAt: string;
  badges?: Array<{ badgeType: string }>;
  replyTo?: ChatMessage;
}

export interface RichTextSegment {
  text: string;
  facet?: Facet;
}

export function segmentRichText(text: string, facets?: Facet[]): RichTextSegment[] {
  if (!facets || facets.length === 0) {
    return [{ text }];
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const bytes = encoder.encode(text);

  // Sort facets by byteStart
  const sorted = [...facets].sort((a, b) => a.index.byteStart - b.index.byteStart);

  const segments: RichTextSegment[] = [];
  let cursor = 0;

  for (const facet of sorted) {
    const { byteStart, byteEnd } = facet.index;
    if (byteStart < cursor || byteEnd > bytes.length) continue;

    // Text before this facet
    if (byteStart > cursor) {
      segments.push({ text: decoder.decode(bytes.slice(cursor, byteStart)) });
    }

    // The facet text
    segments.push({
      text: decoder.decode(bytes.slice(byteStart, byteEnd)),
      facet,
    });

    cursor = byteEnd;
  }

  // Remaining text after last facet
  if (cursor < bytes.length) {
    segments.push({ text: decoder.decode(bytes.slice(cursor)) });
  }

  return segments;
}

export interface StreamInfo {
  title: string;
  handle: string;
}

export interface ChatCallbacks {
  onMessage: (msg: ChatMessage) => void;
  onStreamInfo: (info: StreamInfo) => void;
  onViewerCount: (count: number) => void;
  onOpen: () => void;
  onClose: () => void;
}

export interface ChatConnection {
  close(): void;
}

export function connectChatWs(handle: string, callbacks: ChatCallbacks): ChatConnection {
  const wsUrl = `wss://stream.place/api/websocket/${encodeURIComponent(handle)}`;
  let ws: WebSocket | undefined;
  let closed = false;
  let retryDelay = 1000;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  function connect() {
    if (closed) return;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      retryDelay = 1000;
      callbacks.onOpen();
    };

    ws.onclose = () => {
      callbacks.onClose();
      scheduleReconnect();
    };

    ws.onerror = () => {
      ws?.close();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.$type === "place.stream.chat.defs#messageView") {
          callbacks.onMessage(data as ChatMessage);
        } else if (data.$type === "place.stream.livestream#livestreamView") {
          callbacks.onStreamInfo({
            title: data.record?.title || "",
            handle: data.author?.handle || "",
          });
        } else if (data.$type === "place.stream.livestream#viewerCount") {
          callbacks.onViewerCount(data.count ?? 0);
        }
      } catch {
        // ignore non-JSON messages
      }
    };
  }

  function scheduleReconnect() {
    if (closed) return;
    retryTimer = setTimeout(() => {
      retryDelay = Math.min(retryDelay * 2, 30000);
      connect();
    }, retryDelay);
  }

  connect();

  return {
    close() {
      closed = true;
      clearTimeout(retryTimer);
      ws?.close();
    },
  };
}

// URL regex - matches http:// and https:// URLs
const URL_RE = /https?:\/\/[^\s\])<>]+/g;
// Mention regex - matches @handle.tld patterns
const MENTION_RE = /(?<![.\w])@([\w.-]+\.[\w.-]+)/g;

export function detectFacets(text: string): Facet[] {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  const facets: Facet[] = [];

  // We need byte offsets, so we convert char indices to byte indices
  const charToByteOffset = (charIdx: number): number => {
    return encoder.encode(text.slice(0, charIdx)).byteLength;
  };

  // Detect URLs
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index!;
    // Trim trailing punctuation that's likely not part of the URL
    let uri = match[0];
    while (uri.length > 0 && /[.,;:!?)}\]'"]+$/.test(uri)) {
      uri = uri.slice(0, -1);
    }
    const byteStart = charToByteOffset(start);
    const byteEnd = charToByteOffset(start + uri.length);
    if (byteEnd <= bytes.byteLength) {
      facets.push({
        index: { byteStart, byteEnd },
        features: [{ $type: "app.bsky.richtext.facet#link", uri }],
      });
    }
  }

  // Detect mentions
  for (const match of text.matchAll(MENTION_RE)) {
    const start = match.index!;
    const end = start + match[0].length;
    const byteStart = charToByteOffset(start);
    const byteEnd = charToByteOffset(end);
    if (byteEnd <= bytes.byteLength) {
      // Store the handle; the DID will need to be resolved before sending
      facets.push({
        index: { byteStart, byteEnd },
        features: [{ $type: "app.bsky.richtext.facet#mention", did: match[1] }],
      });
    }
  }

  return facets.sort((a, b) => a.index.byteStart - b.index.byteStart);
}

export interface ReplyRef {
  uri: string;
  cid: string;
}

export async function sendChatMessage(
  oauthAgent: OAuthUserAgent,
  repo: string,
  streamerDid: string,
  text: string,
  resolveHandle?: (handle: string) => Promise<string>,
  reply?: { root: ReplyRef; parent: ReplyRef },
): Promise<void> {
  const rpc = new Client({ handler: oauthAgent });

  let facets = detectFacets(text);

  // Resolve mention handles to DIDs
  if (resolveHandle) {
    facets = await Promise.all(
      facets.map(async (facet) => {
        const feature = facet.features[0];
        if (feature.$type === "app.bsky.richtext.facet#mention") {
          try {
            const did = await resolveHandle(feature.did);
            return {
              ...facet,
              features: [{ $type: "app.bsky.richtext.facet#mention" as const, did }],
            };
          } catch {
            // If resolution fails, drop the facet
            return null;
          }
        }
        return facet;
      }),
    ).then((results) => results.filter((f): f is Facet => f !== null));
  }

  const record: Record<string, unknown> = {
    $type: "place.stream.chat.message",
    text,
    streamer: streamerDid,
    createdAt: new Date().toISOString(),
  };

  if (facets.length > 0) {
    record.facets = facets;
  }

  if (reply) {
    record.reply = reply;
  }

  await rpc.post("com.atproto.repo.createRecord", {
    input: {
      repo: repo as `did:${string}:${string}`,
      collection: "place.stream.chat.message",
      record,
    },
  });
}
