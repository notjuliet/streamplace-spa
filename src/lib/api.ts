import "@atcute/atproto";
import { type DidDocument, getPdsEndpoint, isAtprotoDid } from "@atcute/identity";
import {
  AtprotoWebDidDocumentResolver,
  CompositeDidDocumentResolver,
  CompositeHandleResolver,
  DohJsonHandleResolver,
  PlcDidDocumentResolver,
  WellKnownHandleResolver,
} from "@atcute/identity-resolver";

export const didDocumentResolver = new CompositeDidDocumentResolver({
  methods: {
    plc: new PlcDidDocumentResolver(),
    web: new AtprotoWebDidDocumentResolver(),
  },
});

export const handleResolver = new CompositeHandleResolver({
  strategy: "dns-first",
  methods: {
    dns: new DohJsonHandleResolver({ dohUrl: "https://cloudflare-dns.com/dns-query" }),
    http: new WellKnownHandleResolver(),
  },
});

export const resolveHandle = async (handle: string): Promise<string> => {
  return await handleResolver.resolve(handle as `${string}.${string}`);
};

export const resolveDidDoc = async (did: string): Promise<DidDocument> => {
  if (!isAtprotoDid(did)) {
    throw new Error("Not a valid DID identifier");
  }
  return await didDocumentResolver.resolve(did);
};

const didPDSCache: Record<string, Promise<string>> = {};

export const getPDS = (did: string): Promise<string> => {
  if (did in didPDSCache) return didPDSCache[did];

  if (!isAtprotoDid(did)) {
    return Promise.reject(new Error("Not a valid DID identifier"));
  }

  didPDSCache[did] = (async () => {
    const doc = await didDocumentResolver.resolve(did);
    const pds = getPdsEndpoint(doc);
    if (!pds) {
      delete didPDSCache[did];
      throw new Error("No PDS found");
    }
    return pds;
  })();

  return didPDSCache[did];
};

export interface LiveUser {
  did: string;
  handle: string;
  title: string;
  viewerCount: number;
  thumbRef?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapStream(stream: any): LiveUser {
  return {
    did: stream.author?.did || "",
    handle: stream.author?.handle || "unknown",
    title: stream.record?.title || "Untitled stream",
    viewerCount: stream.viewerCount?.count ?? 0,
    thumbRef: stream.record?.thumb?.ref?.$link,
  };
}

export const fetchLiveUsers = async (): Promise<LiveUser[]> => {
  const res = await fetch("https://stream.place/xrpc/place.stream.live.getLiveUsers");
  if (!res.ok) throw new Error("Failed to fetch live users");
  const data = await res.json();
  const streams = data.streams || [];
  return streams.map(mapStream);
};
