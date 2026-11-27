// @quina/protocol: show protocol v1, shared by the show engine, the relay and every remote (tablet console,
// admin phone, projector stage, a split-mode drum, later the players' app). It imports no engine code.
// docs/protocol.md explains it; this package is its source of truth.
export * from './vocabulary.ts';
export * from './commands.ts';
export * from './events.ts';
export * from './journal.ts';
export * from './scenes.ts';
export * from './resume.ts';
export * from './plan.ts';
export * from './public.ts';
export * from './ranges.ts';
export * from './edition.ts';
