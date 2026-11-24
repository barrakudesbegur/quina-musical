// Shared on-screen words, in Catalan (the only UI language). App-specific copy lives in each app's
// strings.ts; the words every screen must say the same way live here. The labels follow GLOSSARY.md: a
// Round is "Quina N", a Line is "Línia", a Bingo is "Quina!" ("premi de quina"), the Game is "Quina Musical".
import type { ShowScene, WinKind } from '../flow.ts';

export const CA = {
  gameTitle: 'Quina Musical',
  round: (n: number) => `Quina ${n}`,
  roundOf: (n: number, total: number) => `Quina ${n} de ${total}`,
  specialRound: 'Quina especial',
  card: (id: number) => `Cartó ${id}`,
  cards: 'Cartrons',
  line: 'Línia',
  bingo: 'Quina',
  shout: { line: 'LÍNIA!', bingo: 'QUINA!' } satisfies Record<WinKind, string>,
  prize: { line: 'Premi de línia', bingo: 'Premi de quina' } satisfies Record<WinKind, string>,
  sponsoredBy: (name: string) => `Gentilesa de ${name}`,
  checking: (id: number) => `Comprovant el cartó ${id}…`,
  checkValid: 'Cartó correcte!',
  checkInvalid: 'Aquest cartó no té premi',
  landed: 'Ha sonat',
  notLanded: 'No ha sonat',
  nowPlaying: 'Ara sona',
  previous: 'Abans',
  pause: 'Tornem de seguida',
  offline: 'Connexió perduda, tornem de seguida',
  scanYourCard: 'Escaneja el teu cartó',
  nextRound: (n: number) => `Següent: Quina ${n}`,
  thanks: 'Gràcies per venir!',
  winners: 'Guanyadors',
  scene: {
    before: 'Abans de començar',
    roundStart: 'Comença la quina',
    play: 'En joc',
    check: 'Comprovació',
    celebration: 'Celebració',
    interval: 'Mitja part',
    after: 'Final',
  } satisfies Record<ShowScene, string>,
} as const;
