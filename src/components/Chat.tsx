import { CornerDownRight, Reply, Sword, Star, Video, X } from "lucide-solid";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";

import { setShowLoginModal } from "../auth/login-modal";
import { agent, loggedInDid } from "../auth/state";
import { resolveHandle } from "../lib/api";
import {
  connectChatWs,
  segmentRichText,
  sendChatMessage,
  type ChatConnection,
  type ChatMessage,
  type Facet,
  type StreamInfo,
} from "../lib/chat";

export interface ChatProps {
  handle: string;
  streamerDid?: string;
  onStreamInfo?: (info: StreamInfo) => void;
  onViewerCount?: (count: number) => void;
  class?: string;
}

const MAX_MESSAGES = 200;

function getAuthorColor(msg: ChatMessage): string {
  const color = msg.chatProfile?.color;
  if (color && color.red !== undefined) {
    return `rgb(${color.red}, ${color.green}, ${color.blue})`;
  }
  return "#4ade80";
}

function ChatBadges(props: { badges?: ChatMessage["badges"] }) {
  if (!props.badges || props.badges.length === 0) return null;

  return (
    <>
      <For each={props.badges}>
        {(badge) => {
          const type = badge.badgeType;
          if (type === "place.stream.badge.defs#mod") {
            return (
              <span class="mr-0.5 inline-flex align-middle" title="Moderator">
                <Sword size={12} class="text-blue-400" />
              </span>
            );
          }
          if (type === "place.stream.badge.defs#streamer") {
            return (
              <span class="mr-0.5 inline-flex align-middle" title="Streamer">
                <Video size={12} class="text-sp-red" />
              </span>
            );
          }
          if (type === "place.stream.badge.defs#vip") {
            return (
              <span class="mr-0.5 inline-flex align-middle" title="VIP">
                <Star size={12} class="text-yellow-400" />
              </span>
            );
          }
          return null;
        }}
      </For>
    </>
  );
}

function FacetSegment(props: { text: string; facet?: Facet }) {
  if (!props.facet) return <>{props.text}</>;

  for (const feature of props.facet.features) {
    if (feature.$type === "app.bsky.richtext.facet#link") {
      return (
        <a
          href={feature.uri}
          target="_blank"
          rel="noopener noreferrer"
          class="text-sp-accent decoration-sp-accent/40 hover:decoration-sp-accent underline"
        >
          {props.text}
        </a>
      );
    }
    if (feature.$type === "app.bsky.richtext.facet#mention") {
      return (
        <a
          href={`https://bsky.app/profile/${feature.did}`}
          target="_blank"
          rel="noopener noreferrer"
          class="text-sp-accent font-medium"
        >
          {props.text}
        </a>
      );
    }
  }

  return <>{props.text}</>;
}

export function Chat(props: ChatProps) {
  let messagesEl!: HTMLDivElement;
  let ws: ChatConnection | undefined;
  let following = true;
  let seenMessages = new Set<string>();

  const [messages, setMessages] = createSignal<ChatMessage[]>([]);
  const [connected, setConnected] = createSignal(false);
  const [inputText, setInputText] = createSignal("");

  const [replyingTo, setReplyingTo] = createSignal<ChatMessage | undefined>();
  let inputEl!: HTMLInputElement;

  const addMessage = (msg: ChatMessage) => {
    if (seenMessages.has(msg.cid)) return;
    seenMessages.add(msg.cid);

    setMessages((prev) => {
      const msgTime = new Date(msg.indexedAt).getTime();
      const lastTime = prev.length > 0 ? new Date(prev[prev.length - 1].indexedAt).getTime() : 0;

      // Fast path: message is newest (common case for live messages)
      if (msgTime >= lastTime) {
        if (prev.length >= MAX_MESSAGES) {
          seenMessages.delete(prev[0].cid);
          return [...prev.slice(1), msg];
        }

        return [...prev, msg];
      }

      // Slow path: backfill arriving out of order
      let i = prev.length;
      while (i > 0 && new Date(prev[i - 1].indexedAt).getTime() > msgTime) {
        i--;
      }
      const next = [...prev.slice(0, i), msg, ...prev.slice(i)];
      if (next.length > MAX_MESSAGES) {
        seenMessages.delete(next[0].cid);
        return next.slice(1);
      }
      return next;
    });

    // auto-scroll to bottom
    requestAnimationFrame(() => {
      if (messagesEl && following) {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    });
  };

  const connect = () => {
    ws = connectChatWs(props.handle, {
      onMessage: addMessage,
      onStreamInfo: (info) => props.onStreamInfo?.(info),
      onViewerCount: (count) => props.onViewerCount?.(count),
      onOpen: () => setConnected(true),
      onClose: () => setConnected(false),
    });
  };

  const send = async () => {
    const text = inputText().trim();
    if (!text) return;

    const currentAgent = agent();
    const did = loggedInDid();
    const streamerDid = props.streamerDid;
    if (!currentAgent || !did || !streamerDid) return;

    const replyMsg = replyingTo();
    const reply = replyMsg
      ? {
          root: {
            uri: replyMsg.record.reply?.root?.uri ?? replyMsg.uri,
            cid: replyMsg.record.reply?.root?.cid ?? replyMsg.cid,
          },
          parent: { uri: replyMsg.uri, cid: replyMsg.cid },
        }
      : undefined;

    setInputText("");
    setReplyingTo(undefined);
    try {
      await sendChatMessage(currentAgent, did, streamerDid, text, resolveHandle, reply);
    } catch (err) {
      console.error("Failed to send chat:", err);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
    if (e.key === "Escape") {
      setReplyingTo(undefined);
    }
  };

  // keep chat pinned to bottom on new messages and resize, unless user has scrolled up
  const setupScrollFollowing = () => {
    const onScroll = () => {
      following = messagesEl.scrollTop + messagesEl.clientHeight >= messagesEl.scrollHeight - 5;
    };
    messagesEl.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(() => {
      if (following) messagesEl.scrollTop = messagesEl.scrollHeight;
    });
    ro.observe(messagesEl);
    onCleanup(() => {
      messagesEl.removeEventListener("scroll", onScroll);
      ro.disconnect();
    });
  };

  onMount(() => {
    connect();
    setupScrollFollowing();
  });

  onCleanup(() => {
    if (ws) {
      ws.close();
      ws = undefined;
    }
  });

  return (
    <div
      class={`border-sp-border bg-sp-surface flex min-h-0 flex-col border-l ${props.class ?? ""}`}
    >
      {/* Messages */}
      <div ref={messagesEl} class="min-h-0 flex-1 overflow-y-auto pt-2">
        <Show
          when={messages().length > 0}
          fallback={
            <Show when={!connected()}>
              <div class="text-sp-dim flex h-full items-center justify-center text-sm">
                Connecting...
              </div>
            </Show>
          }
        >
          <div class="space-y-1">
            <For each={messages()}>
              {(msg) => (
                <div class="group/msg hover:bg-sp-hover relative px-3 text-sm leading-relaxed">
                  <Show when={agent()}>
                    <button
                      class="text-sp-dim hover:text-sp-accent bg-sp-bg border-sp-border absolute -top-3 right-1 hidden rounded border p-1 shadow-sm transition-colors group-hover/msg:inline-flex"
                      title="Reply"
                      onClick={() => {
                        setReplyingTo(msg);
                        inputEl?.focus();
                      }}
                    >
                      <Reply size={16} />
                    </button>
                  </Show>
                  <Show when={msg.replyTo}>
                    {(parent) => (
                      <div class="text-sp-dim flex items-center gap-1 text-[11px]">
                        <CornerDownRight size={10} class="shrink-0" />
                        <span class="font-medium" style={{ color: getAuthorColor(parent()) }}>
                          {parent().author.handle}
                        </span>
                        <span class="truncate">{parent().record.text}</span>
                      </div>
                    )}
                  </Show>
                  <ChatBadges badges={msg.badges} />
                  <span class="font-medium" style={{ color: getAuthorColor(msg) }}>
                    {msg.author.handle}
                  </span>
                  <span class="text-sp-dim">: </span>
                  <span class="wrap-break-word">
                    <For each={segmentRichText(msg.record.text, msg.record.facets)}>
                      {(seg) => <FacetSegment text={seg.text} facet={seg.facet} />}
                    </For>
                  </span>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* Input */}
      <Show
        when={agent()}
        fallback={
          <button
            class="text-sp-dim hover:text-sp-accent border-sp-border hover:bg-sp-hover mt-2 w-full border-t py-4 text-center text-xs italic transition-colors"
            onClick={() => setShowLoginModal(true)}
          >
            Sign in to chat
          </button>
        }
      >
        <div class="px-2 py-3">
          <Show when={replyingTo()}>
            {(msg) => (
              <div class="bg-sp-bg text-sp-dim mb-1.5 flex items-center gap-1.5 rounded px-2 py-1 text-xs">
                <CornerDownRight size={10} class="shrink-0" />
                <span class="font-medium" style={{ color: getAuthorColor(msg()) }}>
                  {msg().author.handle}
                </span>
                <span class="min-w-0 flex-1 truncate">{msg().record.text}</span>
                <button
                  class="hover:text-sp-text shrink-0 rounded p-0.5 transition-colors"
                  onClick={() => setReplyingTo(undefined)}
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </Show>
          <input
            ref={inputEl}
            type="text"
            placeholder={
              replyingTo() ? `Reply to ${replyingTo()!.author.handle}...` : "Send a message..."
            }
            class="border-sp-border bg-sp-bg text-sp-text placeholder:text-sp-dim focus:border-sp-accent w-full rounded-sm border px-3 py-2.5 text-sm focus:outline-none"
            value={inputText()}
            onInput={(e) => setInputText(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            disabled={!props.streamerDid}
          />
        </div>
      </Show>
    </div>
  );
}
