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
  /** The GameRoom is placed near the venue (Begur, Catalonia). */
  locationHint: 'weur' as DurableObjectLocationHintName,
});

/** The laptop's cloud link (laptop/). */
export const LINK = Object.freeze({
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

/** Durable Object location hints (Cloudflare's names). */
type DurableObjectLocationHintName = 'wnam' | 'enam' | 'sam' | 'weur' | 'eeur' | 'apac' | 'oc' | 'afr' | 'me';
