// DEPRECATED: the public feed now lives in @quina/protocol (protocol/public.ts), merged from this draft. This
// re-export only keeps importers of the old path working (the player app's player/feed/public.ts); delete it
// once they import '@quina/protocol'.
export { PUBLIC_FEED, emptyPublicState, newGamePublicState, applyPublic, followFeed, isPublicMessage, reconnectDelayMs, cardsParam, parseCardsParam, roundGameEnd } from '@quina/protocol';
export type { PublicChange, PublicChangeKind, PublicCheck, PublicDelta, PublicHeat, PublicInterval, PublicLanding, PublicLink, PublicMessage, PublicRound, PublicScene, PublicShuffle, PublicSnapshot, PublicSpin, PublicState, PublicView, PublicWinKind, PublicWinner } from '@quina/protocol';
