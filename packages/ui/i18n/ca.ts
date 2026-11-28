// Shared on-screen words, in Catalan (the only UI language). App-specific copy lives in each app's
// strings.ts; the words every screen must say the same way live here. The labels follow GLOSSARY.md: a
// Round is "Quina N", a Line is "Línia", a Bingo is "Quina!" ("premi de quina"), the Game is "Quina Musical".
import type { ShowScene, WinKind } from '../flow.ts';

/** "abans del tercer": the last of the Suspens window's vibrations ("cops", masculine). */
const lastVibration = (n: number) => (n === 3 ? 'del tercer' : n === 2 ? 'del segon' : "de l'últim");

export const CA = {
  gameTitle: 'Quina Musical',
  /** A normal round by its Quina number, not the plan's: screens name a round with plan.ts roundTitle. */
  round: (n: number) => `Quina ${n}`,
  roundOf: (n: number, total: number) => `Quina ${n} de ${total}`,
  specialRound: 'Quina Especial',
  desgraciatRound: 'Quina del Desgraciat',
  /** The Desgraciat round's name where space is short (D251): the console's header, the Check's chip. */
  desgraciatShort: 'Desgraciat',
  /** A card by its number, as the design system writes card numbers (components-v2.md §11, 28 Nov): «Cartró #57». */
  card: (id: number) => `Cartró #${id}`,
  /** A printed card type card-types.json doesn't name (its id, "Cartró daurat"). */
  cardType: (id: string) => `Cartró ${id}`,
  cards: 'Cartrons',
  line: 'Línia',
  bingo: 'Quina',
  /** The Desgraciat round's win: the last card standing. */
  standing: 'Dempeus',
  /** The Celebration's title for everyone. The Desgraciat round has none here (the user, U6): its win shows the music,
   * the confetti and the prize, with no word shouted; only the screens below say `potra`. */
  shout: { line: 'LÍNIA!', bingo: 'QUINA!', standing: null } satisfies Record<WinKind, string | null>,
  /** The Desgraciat winner's title: on the projector (D186) and on the winner's own phone (D190), never anyone else's. */
  potra: 'Quina potra!',
  prize: { line: 'Premi de línia', bingo: 'Premi de quina', standing: "Premi de l'últim dempeus" } satisfies Record<WinKind, string>,
  sponsoredBy: (name: string) => `Gentilesa de ${name}`,
  /** The sponsors' logos (G4): the phone's list and its dialog. */
  sponsors: { list: 'Patrocinadors', show: (name: string) => `${name}: mostra el logo més gran`, close: 'Tanca' },
  /** Under a bundle's headline prizes: how many smaller ones come with them. */
  morePrizes: (n: number) => (n === 1 ? 'i 1 premi més' : `i ${n} premis més`),
  checking: (id: number) => `Comprovant el cartró #${id}…`,
  checkValid: 'Cartró correcte!',
  checkInvalid: 'Aquest cartró no té premi',
  landed: 'Ha sonat',
  notLanded: 'No ha sonat',
  nowPlaying: 'Ara sona',
  previous: 'Abans',
  pause: 'Tornem de seguida',
  offline: 'Connexió perduda, tornem de seguida',
  scanYourCard: 'Escaneja el teu cartró',
  /** "Següent: Quina 4", with the round's name (plan.ts roundTitle). */
  nextRound: (name: string) => `Següent: ${name}`,
  thanks: 'Gràcies per venir!',
  winners: 'Guanyadors',
  /** The game's concepts' names on screen (GLOSSARY.md), shared by every app through packages/ui/concepts.ts. */
  concepts: {
    hold: 'Parlem',
    pause: 'Pausa',
    stay: 'Aguanta',
    suspense: 'Suspens',
    back: 'Enrere',
    next: 'Següent',
    claim: 'Comprovar cartró',
    checkReveal: 'Destapa',
    review: 'Revisió manual',
    celebration: 'Celebrem!',
    checkFail: 'Fallada',
    lastStanding: 'Quina potra!',
    fallen: 'Assegut',
    throw: 'Llançament',
    storm: 'Tempesta',
    break: 'Descans',
  },
  /** The Wii remote's guide (the console's Comandament dialog and the printed cheat sheet): wii/legend.ts. */
  wii: {
    title: 'Comandament',
    keys: { a: 'A', b: 'B', talk: '− +', back: '1 2', home: 'HOME', dpad: '✚' },
    a: {
      title: 'A · acció per defecte',
      note: 'Fa el que faria el botó marcat amb la A a la consola: Següent mentre sona la música; a la comprovació, destapa la cançó següent i després fa el senyal. Mantinguda, les destapa seguides.',
    },
    b: { title: 'B (al darrere) · mantén: Aguanta', note: 'B és el gallet de sota. Mantén-lo: la cançó segueix i no avança.' },
    /** Suspens with B + A (D144, D147): it enters like the manual one, with its vibrations (D148). A first and B while
     * A is still down turns the Spin A started into it (D176, D177). */
    bA: {
      key: 'B + A',
      title: 'B + A · Suspens',
      note: (vibrations: number, seconds: string) =>
        `Amb B premut, mantén A: vibra ${vibrations} cops (~${seconds} s). Deixar anar A abans ${lastVibration(vibrations)} el cancel·la; després, deixar anar B l'aterra. També A i, sense deixar-la, B: el gir que comença es fa Suspens.`,
    },
    /** The shake (D144), on by default (D148). */
    shake: {
      title: 'B + sacsejar · Suspens',
      note: 'Amb B premut, sacseja 3 cops: Suspens. Cada sacsejada vibra. Activat per defecte; es pot apagar.',
      switchLabel: 'Sacsejar per fer Suspens',
      switchNote: 'Amb B premut, 3 cops',
      switchDefault: 'Activat per defecte',
    },
    /** With «Avanç manual», B alone is Suspens (D145). */
    bManual: {
      title: 'B amb «Avanç manual» · Suspens',
      note: (vibrations: number, seconds: string) =>
        `Mantenir B ja és Suspens: vibra ${vibrations} cops (~${seconds} s). Deixar-lo anar abans ${lastVibration(vibrations)} el cancel·la; després vibra suau mentre dura, i en deixar-lo anar, aterra.`,
    },
    talk: {
      title: '− o + · toca: Parlem · mantén: Pausa',
      note: 'A la Pausa sona la seva música, i durant una quina les pantalles ho diuen. Toca per sortir-ne. A la comprovació, mantenir-los la passa a revisió manual.',
    },
    back: { title: (seconds: string) => `1 o 2 · mantén ${seconds} s: Enrere`, note: "Desfà l'última cançó. A la comprovació, un toc treu l'última marca." },
    home: { title: 'HOME · automàtic o «Avanç manual»', note: 'Vibra diferent per a cada un.' },
    dpad: {
      title: 'Creu · efectes',
      note: (d: { up: string; right: string; down: string; left: string }) => `Amunt ${d.up} · dreta ${d.right} · avall ${d.down} · esquerra ${d.left}`,
    },
    footer: 'Cada acció fa vibrar el comandament. Els cartrons cantats es comproven a la consola, no amb el comandament.',
    side: 'de costat',
  },
  /** The generic controls' own words (packages/ui/components): a long press's hint and its reduced-motion percent. */
  controls: {
    holdHint: 'Mantén premut per confirmar',
    percent: (p: number) => `${p} %`,
    /** A two-level button's hold, for screen readers. */
    holdFor: (level: string) => `Mantén premut per passar a ${level}`,
  },
  scene: {
    before: 'Abans de començar',
    roundStart: 'Comença la quina',
    play: 'En joc',
    check: 'Comprovació',
    celebration: 'Celebració',
    interval: 'Descans',
    after: 'Final',
  } satisfies Record<ShowScene, string>,
} as const;
