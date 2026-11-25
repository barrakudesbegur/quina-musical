// Shared on-screen words, in Catalan (the only UI language). App-specific copy lives in each app's
// strings.ts; the words every screen must say the same way live here. The labels follow GLOSSARY.md: a
// Round is "Quina N", a Line is "Línia", a Bingo is "Quina!" ("premi de quina"), the Game is "Quina Musical".
import type { ShowScene, WinKind } from '../flow.ts';

export const CA = {
  gameTitle: 'Quina Musical',
  round: (n: number) => `Quina ${n}`,
  roundOf: (n: number, total: number) => `Quina ${n} de ${total}`,
  specialRound: 'Quina Especial',
  desgraciatRound: 'Quina Desgraciada',
  card: (id: number) => `Cartró ${id}`,
  /** A printed card type card-types.json doesn't name (its id, "Cartró daurat"). */
  cardType: (id: string) => `Cartró ${id}`,
  cards: 'Cartrons',
  line: 'Línia',
  bingo: 'Quina',
  /** The Desgraciat round's win: the last card standing. */
  standing: 'Dempeus',
  /** The Celebration's title. The Desgraciat round has none (the user, U6): its win shows the music, the confetti and
   * the prize, with no word shouted. */
  shout: { line: 'LÍNIA!', bingo: 'QUINA!', standing: null } satisfies Record<WinKind, string | null>,
  prize: { line: 'Premi de línia', bingo: 'Premi de quina', standing: "Premi de l'últim dempeus" } satisfies Record<WinKind, string>,
  sponsoredBy: (name: string) => `Gentilesa de ${name}`,
  /** Under a bundle's headline prizes: how many smaller ones come with them. */
  morePrizes: (n: number) => (n === 1 ? 'i 1 premi més' : `i ${n} premis més`),
  checking: (id: number) => `Comprovant el cartró ${id}…`,
  checkValid: 'Cartró correcte!',
  checkInvalid: 'Aquest cartró no té premi',
  landed: 'Ha sonat',
  notLanded: 'No ha sonat',
  nowPlaying: 'Ara sona',
  previous: 'Abans',
  pause: 'Tornem de seguida',
  offline: 'Connexió perduda, tornem de seguida',
  scanYourCard: 'Escaneja el teu cartró',
  nextRound: (n: number) => `Següent: Quina ${n}`,
  thanks: 'Gràcies per venir!',
  winners: 'Guanyadors',
  /** The Wii remote's guide (the console's Comandament dialog and the printed cheat sheet): wii/legend.ts. */
  wii: {
    title: 'Comandament',
    keys: { a: 'A', b: 'B', talk: '− +', back: '1 2', home: 'HOME', dpad: '✚' },
    a: {
      title: 'A · acció per defecte',
      note: 'Fa el que faria el botó marcat amb la A a la consola: Següent mentre sona la música; a la comprovació, aprova el cartró si és bo i el rebutja si no.',
    },
    b: { title: 'B (al darrere) · mantén: Aguanta', note: 'Sense deixar anar B, sacseja fort 3 cops: passa a Suspens. En deixar anar B, aterra.' },
    talk: { title: '− o + · toca: Parlem · mantén: Pausa', note: 'A la Pausa sona la música de la mitja part i les pantalles ho diuen. Toca per sortir-ne.' },
    back: { title: (seconds: string) => `1 o 2 · mantén ${seconds} s: Enrere`, note: "Desfà l'última cançó." },
    home: { title: 'HOME · automàtic sí / no', note: "Vibra diferent quan s'activa i quan es desactiva." },
    dpad: {
      title: 'Creu · efectes',
      note: (d: { up: string; right: string; down: string; left: string }) => `Amunt ${d.up} · dreta ${d.right} · avall ${d.down} · esquerra ${d.left}`,
    },
    footer: 'Cada acció fa vibrar el comandament. Els cartrons cantats es comproven a la consola, no amb el comandament.',
    side: 'de costat',
  },
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
