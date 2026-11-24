// The public phone feed's contract, from the Platform session's module (cloud/src/feed/public.ts, a draft of
// `protocol/public.ts`). Everything in player/ imports the feed's types and helpers from here, so when the
// module moves into @quina/protocol this one line changes and nothing else.
export * from '../../cloud/src/feed/public.ts';
