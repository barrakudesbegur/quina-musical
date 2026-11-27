// Card numbers written back as ranges, the way `setCardsInPlay` and `addCardsInPlay` take them ("1-180, 200-215, 400"):
// Admin's preview and the console's «Cartrons venuts» (D234) both send them. One copy, the protocol's (the engine merges
// with it too); reading them is the protocol's parseCardRanges.
export { formatCardRanges } from '@quina/protocol';
