// Every tunable of the cloud and the laptop's cloud link. The phones' own tunables (reconnect, offline notice,
// card cap) live in the public feed contract (protocol/public.ts `PUBLIC_FEED`), because the player app shares them.

export const CLOUD = Object.freeze({
  /** The most entries one `link.journal` upload may carry. The link sends bigger backlogs in several. */
  maxEntriesPerUpload: 200,
  /** The largest message the Durable Object accepts from the laptop (bytes of JSON text). */
  maxLinkMessageBytes: 1 << 20,
  /** One journal entry may not be bigger than this (a `round.started` with a 500-song Queue is about 4 KB). */
  maxEntryBytes: 64 * 1024,
  /**
   * The laptop counts as offline when nothing has arrived from it for this long. The link sends a keepalive
   * every `linkKeepaliveMs` when it has nothing else to say, so a silence means the connection is gone.
   */
  showSilenceMs: 50_000,
  /** The longest banner Admin may send to every phone. */
  maxNoticeLength: 200,
  /** The largest Game plan Admin may save (bytes of JSON). Logos are files, never inside it. */
  maxPlanBytes: 256 * 1024,
  /**
   * Media Admin uploads (sponsor logos, prize pictures), kept in the GameRoom. Each is a pair, keyed by the
   * fallback's content hash: the PNG or JPEG at /media/<key>.png|.jpg and its JPEG XL at /media/<key>.jxl (the
   * user's choice: JXL, never WebP; Admin encodes it in the browser). Each file at most maxBytes.
   */
  media: {
    maxBytes: 300 * 1024,
    maxFiles: 200,
    /** The fallbacks: raster images only (an SVG served from this origin could run script). */
    types: { 'image/png': 'png', 'image/jpeg': 'jpg' } as Readonly<Record<string, string>>,
    maxNameLength: 100,
    /** How long a .jxl URL that answered with the fallback (no JXL yet) may be cached. */
    fallbackForJxlMaxAgeS: 300,
  },
  /**
   * The phones' beat (PublicState.beat) is sent again for the same engine beat only when its downbeat, on the cloud's
   * clock, moved this many ms or more from the one last sent. The clock offset (domain/clock.ts) only steps down, to a
   * new smallest (received − sent) sample, by a few ms once settled: this keeps those steps from re-sending the beat to
   * every phone, while the engine's own re-anchors (drift beyond about 30 ms, a landing, a loop re-cue, a Pausa resume)
   * always pass. Phones stay within this of the projector, and a slow drift corrects itself once it passes it, since the
   * comparison is with the last value sent. A new bpm or metre is always sent.
   */
  beatResendMs: 10,
  /** The GameRoom is placed near the venue (Begur, Catalonia). */
  locationHint: 'weur' as DurableObjectLocationHintName,
});

/** The laptop's cloud link (laptop/). */
export const LINK = Object.freeze({
  /** How long the link waits for one of the plan's images from the cloud (/media/…). */
  mediaFetchTimeoutMs: 15_000,
  /** A keepalive when nothing else was sent for this long: one client, about 1 request an hour (20 messages = 1). */
  keepaliveMs: 20_000,
  /** Reconnect to the cloud: full jitter, the first retry within 1 s, doubling up to 30 s. */
  reconnectFirstMs: 1_000,
  reconnectCapMs: 30_000,
  /** A connection that stayed up this long resets the backoff. */
  stableAfterMs: 60_000,
  /** Reconnect to the local relay: it is on the same machine, so retry quickly. */
  relayRetryMs: 1_000,
  /** At most one forwarded `state` per this many ms (the latest wins), for the consoles connected through the cloud. */
  stateEveryMs: 250,
  /** Wait this long for an ack before sending the same upload again. */
  ackTimeoutMs: 10_000,
});

/** The media sync (laptop/media-sync.ts, `npm run media -- push|pull`). */
export const MEDIA_SYNC = Object.freeze({
  /** Blobs moving at once. */
  concurrency: 4,
  /**
   * Tries per request (each blob's upload or download, a page of the bucket's list, a manifest's GET and PUT, a prune) when the failure may pass: a
   * network error (an HTTP/2 stream reset killed a 2,796-file push once), HTTP 5xx or 429, or a download cut off.
   */
  attempts: 5,
  /** The wait before each retry, as the link's reconnect: full jitter, the first within 1 s, doubling up to 30 s. */
  retryFirstMs: 1_000,
  retryCapMs: 30_000,
});

/** Durable Object location hints (Cloudflare's names). */
type DurableObjectLocationHintName = 'wnam' | 'enam' | 'sam' | 'weur' | 'eeur' | 'apac' | 'oc' | 'afr' | 'me';
