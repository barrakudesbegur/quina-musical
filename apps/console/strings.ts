// Every word the console shows, in Catalan. Shared terms come from ui/i18n/ca.ts so every screen says them
// the same way; this file holds the console's own copy. Components never inline text: they read it here.
// Maps keyed by protocol vocabulary are Partial with a fallback, so a new reason or command from the engine
// shows something sensible instead of breaking the build; tests/ui/console/strings.test.ts checks that
// every known value has its own text.
import type { AutoSound, BreakSet, HoldReason, MusicSet, PhaseName, RejectReason, ShowStatus, SoundName, SoundTestKind, ThrowSong, VolumeKey } from '@quina/protocol';
import { CA } from '../../packages/ui/i18n/ca.ts';
import { roundTitle, roundTitleOf } from '../../packages/ui/plan.ts';
import type { AnyCommandName, CelebrationMusic, ClaimStatus, WinKind } from '../../packages/ui/flow.ts';
import type { HeaderChip, LinkName, LinkState } from './logic/status.ts';
import type { RecoveryNotice } from './logic/pace-panel.ts';
import type { ChartGap } from './logic/future.ts';
import type { VolumeGroup } from './logic/volumes.ts';
import type { FinalePadMode, FinaleRefusal, FinaleSize, FinaleTabView, FinaleVerdict } from './logic/finale.ts';
import { STANDING_LIST_MAX } from '@quina/protocol';
import type { ConsoleCommand, Theme } from './config.ts';
import type { WiiStatus } from './wii/controller.svelte.ts';

export { CA };

const seconds = (s: number) => `${s} s`;
const kindLabel: Record<WinKind, string> = { line: CA.line, bingo: CA.bingo, standing: CA.standing };
/** "A, B i C". */
const listing = (items: readonly string[]) => (items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} i ${items[items.length - 1]}`);
/** "1a", "2a", "3a": a song's place (cançó is feminine). */
const ordinal = (n: number) => `${n}a`;

export const S = {
  pageTitle: 'Consola · Quina Musical',
  /** A round's name: "Quina 4" by its Quina number, "Quina Especial", "Quina Desgraciada" (plan.ts roundTitle). */
  round: roundTitle,
  /** With the night's total: "Quina 4 de 8" (what the total counts is pending U163); a special round has none. */
  roundOf: roundTitleOf,

  header: {
    label: 'Estat del show',
    heat: 'Escalfor de la quina',
    /** The Heat meter's spoken value. */
    heatText: (percent: number | null, phase: string, climbing: string, fixed: boolean) =>
      `${percent === null ? 'sense dades' : `${percent} %`}, fase ${phase.toLowerCase()}${fixed ? ' (fixada des del menú)' : ''}, ${climbing}`,
    phaseFixed: 'Fase fixada des del menú',
    clock: 'Hora',
    roundEnd: 'Final previst de la quina',
    gameEnd: 'Final previst de la nit',
    drift: 'Horari',
    menu: 'Menú: més opcions',
    demo: (name: string) => `Demo: ${name}`,
    noRound: CA.gameTitle,
    stale: 'Dades antigues',
  },

  phase: { early: 'Inici', mid: 'Mig', late: 'Tardana', final: 'Final' } satisfies Record<PhaseName, string>,
  climbing: { line: 'cap a la línia', bingo: 'cap a la quina', standing: 'fins que en quedi un dempeus' } satisfies Record<WinKind, string>,

  links: {
    title: 'Connexions',
    names: { relay: 'Portàtil', show: 'Show', cloud: 'Núvol', feed: 'Mòbils', wii: 'Wii' } satisfies Record<LinkName, string>,
    chips: { cloud: 'Núvol', lan: 'LAN', feed: 'Mòbils', wii: 'Wii' } satisfies Record<HeaderChip, string>,
    states: { up: 'connectat', down: 'desconnectat', unknown: 'encara no disponible' } satisfies Record<LinkState, string>,
    unknownShort: '—',
  },

  alerts: {
    disconnected: 'Sense connexió amb el portàtil. Reconnectant…',
    unpaired: "Aquest dispositiu no està vinculat amb el portàtil. Obriu la consola amb l'enllaç o el QR del portàtil (porta el codi «t=»).",
    showOffline: 'La pàgina del show no està oberta al portàtil: les ordres no arriben.',
    waiting: "Esperant l'estat del show…",
    locked: 'La pàgina del show espera un clic a «Start show» al portàtil.',
  },

  status: { locked: 'Bloquejat', idle: 'Preparat', playing: 'Sonant', transition: 'Girant', hold: 'En espera' } satisfies Record<ShowStatus, string>,

  cluster: {
    label: 'Controls principals',
    next: CA.concepts.next,
    talk: CA.concepts.hold,
    talkNote: 'toca: la música baixa',
    stay: CA.concepts.stay,
    stayNote: 'toca: la cançó segueix',
    /** A pressed Parlem or Aguanta: pressing it again releases the Hold. */
    activeNote: 'prem per reprendre',
    /** The second levels, reached by holding Parlem or Aguanta. */
    pauseLevel: CA.concepts.pause,
    suspense: CA.concepts.suspense,
    /** On the second-level strip: hold the button to get there. */
    holdFor: 'mantén',
    /** Spoken: what holding the button does. */
    holdForLong: CA.controls.holdFor,
    /** The second level is on: a tap leaves it. */
    pauseOn: 'en pausa · toca per tornar',
    /** Spoken, on Parlem's lock during Pausa: Parlem stays on until Pausa ends (D128). */
    talkLocked: 'Parlem queda posat mentre dura la pausa',
    suspenseOpen: 'deixa anar per aterrar',
    suspenseTap: 'toca per aterrar',
    /** D234: the button held on another console (`twoLevelHeld`), locked here until it's let go: its note, and the
     *  padlock's spoken label. `anotherConsole`: a holder with no device label of its own. */
    heldElsewhere: (name: string) => `la manté ${name}`,
    heldElsewhereLong: (name: string) => `La manté ${name}: queda bloquejat fins que la deixi anar`,
    anotherConsole: 'una altra consola',
    suspenseAutoRelease: (s: number) => `s'allibera sol en ${s} s`,
    back: CA.concepts.back,
    /** Under "Enrere" in its narrow button: just "hold, don't tap". */
    backHint: 'mantén',
    claim: CA.concepts.claim,
  },

  longPress: { hint: CA.controls.holdHint, percent: CA.controls.percent },

  nowPlaying: {
    title: CA.nowPlaying,
    nothing: 'No sona cap cançó',
    holdMusic: "Música d'espera",
    errorMusic: "Música d'error",
    seconds,
    /** The ring by the song (logic/now-ring.ts): its spoken label, its corner badge and the chip under the song. */
    ring: {
      label: {
        auto: (s: number) => `Següent automàtic en ${s} ${s === 1 ? 'segon' : 'segons'}`,
        spinning: (s: number | null) => (s === null ? 'Girant' : `Girant: la cançó nova aterra en ${s} ${s === 1 ? 'segon' : 'segons'}`),
        suspense: (s: number | null) => (s === null ? 'Suspens obert' : `Suspens obert: s'allibera sol en ${s} ${s === 1 ? 'segon' : 'segons'}`),
        manual: 'Avanç manual: prem Següent',
        manualFinal: 'Fase final: sense avanç automàtic. Prem Següent',
        lastStanding: "Només en queda un dempeus: comproveu-lo",
        held: 'En espera: sense avanç automàtic',
        checking: 'En espera: comprovant un cartró',
        checkFailed: "En espera: música d'error fins a Reprèn",
        paused: 'Pausa',
        waiting: 'Esperant «Següent»',
      },
      badge: { auto: 'Avança sol', autoOff: 'Avanç manual', final: 'Fase final', talk: 'Parlem', stay: 'Aguanta', held: 'En espera' },
      chip: {
        spinning: (s: number | null) => (s === null ? 'Girant' : `Girant · aterra en ${s} s`),
        suspense: 'Suspens obert · deixa anar per aterrar',
        manual: 'Manual · prem «Següent»',
        manualFinal: 'Fase final · prem «Següent»',
        lastStanding: (cardId: number | null) => (cardId === null ? "Últim cartró dempeus · comprova'l" : `Últim cartró dempeus · comprova el #${cardId}`),
        talk: (since: string) => `Parlem · des de fa ${since}`,
        stay: (since: string) => `Aguanta · des de fa ${since}`,
        checking: (cardId: number | null) => (cardId === null ? 'Comprovant un cartró' : `Comprovant el cartró #${cardId}`),
        checkFailed: 'Cap cartró vàlid · prem «Reprèn»',
        discarded: 'Cartró descartat',
        paused: (since: string) => `Pausa · des de fa ${since}`,
      },
    },
    lastSpinBy: (device: string | null) => (device ? `Últim gir: ${device}` : 'Últim gir: automàtic'),
  },

  nextSong: {
    title: 'Següent',
    private: 'Privat: només a la consola',
    none: 'Final de la cua',
    landsIn: (s: number) => `Aterra en ${s} s`,
    toLand: 'per aterrar',
    suspenseOpen: 'Suspens obert',
    decoding: 'Carregant la cançó…',
    seconds,
  },

  pace: {
    title: 'Ritme',
    value: (s: number) => `${s} s`,
    presets: 'Ritmes predefinits',
    minusLabel: (step: number) => `Ritme ${step} s més ràpid`,
    plusLabel: (step: number) => `Ritme ${step} s més lent`,
    lock: 'Bloquejar',
    lockNote: "Bloqueja el ritme: sense correccions per recuperar l'horari",
    auto: 'Auto',
    autoNote: 'Avanç automàtic',
    autoFinal: 'Avanç automàtic a la fase final',
    /** Each preset's name, keyed by its seconds; a preset without one shows only its seconds. */
    names: { 11: 'Molt ràpid', 14: 'Ràpid', 18: 'Normal', 22: 'Tranquil' } as Readonly<Partial<Record<number, string>>>,
    recommended: 'Recomanat',
    /** At the end of the title row: a song's first play in the Game gets the Pace × 22/14 (D174; pace.firstPlaySec). */
    firstPlay: 'Cançons noves:',
    firstPlayNote: 'Una cançó que encara no ha sonat aquesta nit dura més: el ritme × 22/14',
    /** A preset button's accessible name ("Ràpid, 14 s, recomanat"). */
    presetLabel: (name: string | null, s: number, recommended: boolean) => [name, `${s} s`, recommended ? 'recomanat' : null].filter(Boolean).join(', '),
    recovery: ({ direction, seconds: s }: RecoveryNotice) =>
      direction === 'faster'
        ? `Recuperant l'horari: cada cançó dura ${s > 0 ? `${s} s` : 'una mica'} menys.`
        : `Anem avançats: cada cançó dura ${s > 0 ? `${s} s` : 'una mica'} més.`,
  },

  /** The Futur tab (D170): hidden until «Mirar el futur»; then the first wins and the songs to come. */
  future: {
    hiddenNote: 'Qui pot guanyar i les cançons que vindran, en ordre. Amagat perquè també us agafi per sorpresa.',
    show: 'Mirar el futur',
    /** The switch on the Futur tab (D-g): on while the future shows. */
    visible: 'Visible',
    unknown: '—',
    firstLine: 'Primera línia',
    bingo: 'Quina',
    now: 'Ja hi és',
    done: 'Confirmada',
    atLeast: (n: number) => `com a mínim d'aquí a ${n}`,
    inSongs: (n: number) => (n === 1 ? 'La següent' : `D'aquí a ${n}`),
    never: 'Cap en aquesta quina',
    winners: 'Possibles guanyadors',
    none: 'Encara cap',
    kind: kindLabel,
    rows: (rows: readonly number[]) => (rows.length === 1 ? `fila ${rows[0]}` : `files ${listing(rows.map(String))}`),
    completedBy: (title: string) => `amb «${title}»`,
    /** How far a possible winner's win is: "ara" (it has it), "+4". */
    at: (n: number) => (n === 0 ? 'ara' : `+${n}`),
    winnerLabel: (cardId: number, kind: string, n: number) => `#${cardId}, ${kind}, ${n === 0 ? 'ja la té' : `d'aquí a ${n} cançons`}`,
    notSold: 'No venut',
    notSoldLong: 'No registrat com a venut',
    noCardsInPlay: "No hi ha cartrons en joc registrats: no es pot avisar dels que no s'han venut.",
    inPlayError: 'Els cartrons en joc no es poden llegir.',
    /** The upcoming songs (D170): each one's distance, and what it brings. */
    upcoming: 'Les properes, en ordre',
    waiting: "Demanant l'ordre de les cançons…",
    noneLeft: 'No en queden més en aquesta quina.',
    offset: (n: number) => `+${n}`,
    /** The songs left until the next win: "falten 3" for the Line (or the last card standing), "quina: falten 26". */
    count: (toward: WinKind, left: number) => `${toward === 'bingo' ? 'quina: ' : ''}${left === 1 ? 'falta 1' : `falten ${left}`}`,
    /** The win a song completes: "Línia · #112 #204"; the Desgraciat round's "L'últim dempeus". */
    win: (kind: WinKind, cardIds: readonly number[]) => (kind === 'standing' ? "L'últim dempeus" : [kindLabel[kind], cardIds.map((id) => `#${id}`).join(' ')].filter(Boolean).join(' · ')),
    /** The Desgraciat round: the songs until one card stands, and the count's curve. */
    untilLast: "Fins a l'últim dempeus",
    lastNow: 'Ja només en queda un',
    curve: 'Cartrons dempeus després de cada cançó',
    curveBar: (song: number, standing: number) => `${song === 1 ? 'Després de la següent cançó' : `D'aquí a ${song} cançons`}: ${standing} dempeus`,
    curveFirst: 'la següent',
    curveLast: (song: number) => `d'aquí a ${song}`,
    noWinnersHere: 'En aquesta quina no hi ha possibles guanyadors: la pestanya Dempeus diu qui queda.',
  },

  /** The Estat tab (D170, D173): how close everyone is, and the round's songs so far. Nothing of the future. */
  estat: {
    chart: (kind: 'line' | 'bingo') => `Cartrons segons quantes cançons els falten per a ${kind === 'line' ? 'línia' : 'quina'}`,
    row: (missing: number, orMore: boolean) => (missing === 0 ? 'Ja en tenen' : orMore ? `Falten ${missing}+` : missing === 1 ? 'Falta 1' : `Falten ${missing}`),
    rowLabel: (missing: number, orMore: boolean, cards: number) =>
      `${cards} ${cards === 1 ? 'cartró' : 'cartrons'}: ${missing === 0 ? 'ja en tenen' : `en falten ${missing}${orMore ? ' o més' : ''}`}`,
    validCount: (n: number) => `${n} cartrons en joc en aquesta quina`,
    unknown: '—',
    gaps: {
      cards: 'Falten els cartrons impresos (cards.json).',
      inPlay: 'No hi ha cartrons en joc registrats.',
      landings: "Aquesta consola no ha vist totes les cançons d'aquesta quina.",
    } satisfies Record<ChartGap, string>,
  },

  /** The round's played songs, newest first (Estat, and Cerca before anything is typed). */
  played: {
    title: (n: number) => `Han sonat · ${n}`,
    newest: 'la més nova a dalt',
    newestInOrder: "la més nova a dalt, en l'ordre en què han sonat",
    none: 'Encara no ha sonat cap cançó en aquesta quina.',
    partial: "Aquesta consola no ha vist les primeres cançons d'aquesta quina.",
    /** A song's place in the round: "23a". */
    place: ordinal,
    now: 'ara sona',
    ago: (n: number) => (n === 0 ? "l'última" : `fa ${n}`),
  },

  /** The Cerca tab (D162, D170, D187): a song, or a card's private preview. */
  cerca: {
    modes: { songs: 'Cançons', card: 'Cartró' },
    modeLabel: 'Què cerques',
    /** The field's visible label (D-f); the placeholder is only a hint. */
    label: 'Cerca una cançó de la quina',
    placeholder: 'Títol o artista, encara que sigui a mitges',
    clear: 'Esborra la cerca',
    count: (n: number) => (n === 1 ? '1 cançó' : `${n} cançons`),
    ofRound: (total: number) => `de les ${total} de la quina`,
    noMatch: (query: string) => `Cap cançó de la quina s'assembla a «${query}».`,
    /** Where a found song stands. Never when it will play: that's the Futur's. */
    status: {
      now: 'Ara sona',
      played: (place: number, ago: number) => `Ha sonat: la ${ordinal(place)}, ${ago === 0 ? "l'última" : `fa ${ago}`}`,
      earlier: 'Ha sonat',
      notYet: 'Encara no ha sonat',
      unknown: "No se sap: aquesta consola no ha vist totes les cançons d'aquesta quina",
    },
    /** The card's number, typed on the tab's own keypad (so the tablet's keyboard never covers the card). */
    number: 'Número del cartró',
    keypad: 'Teclat del número del cartró',
    erase: 'Esborra una xifra',
    enter: 'Mostra el cartró',
    clearCard: 'Un altre cartró',
    hint: 'El número del cartró. ↵ el mostra: les cançons que han sonat i les que no, només aquí.',
    showFuture: 'Mostra el futur',
    notSold: 'No venut',
    noCards: 'Falten els cartrons impresos (cards.json): no es pot mirar cap cartró.',
    unknownCard: (id: number) => `No hi ha cap cartró #${id}.`,
    otherRound: (id: number, type: string) => `El #${id} és un cartró ${type}: no juga aquesta quina.`,
    playedOf: (n: number, total: number) => `${n} de ${total} han sonat`,
    rows: (rows: readonly number[]) => (rows.length === 1 ? `fila ${rows[0]}` : `files ${listing(rows.map(String))}`),
    lineMissing: (missing: number, rows: string) => (missing === 0 ? `Línia: ja la té (${rows})` : `Línia: en ${missing === 1 ? 'falta 1' : `falten ${missing}`} (${rows})`),
    bingoMissing: (missing: number) => (missing === 0 ? 'Quina: la té' : `Quina: en ${missing === 1 ? 'falta 1' : `falten ${missing}`}`),
    cellLabel: (title: string, played: boolean, ahead: number | null) => `${title}: ${played ? 'ha sonat' : ahead !== null ? `no ha sonat, sonarà d'aquí a ${ahead}` : 'no ha sonat'}`,
    waiting: "Demanant l'ordre de les cançons…",
    canWin: 'Pot guanyar',
    cannotWin: 'Ja no pot guanyar',
    winLine: (rows: string, n: number, title: string) => (n === 0 ? `Ja té línia, a la ${rows}.` : `La línia, a la ${rows}, a +${n} amb «${title}»: és la primera.`),
    winBingo: (n: number, title: string) => (n === 0 ? 'Ja té quina.' : `La quina, a +${n} amb «${title}»: és la primera.`),
    lostLine: (missing: number, at: number | null, first: number) =>
      at === null
        ? 'La línia no li arriba en aquesta quina.'
        : `${missing === 1 ? "Li'n falta 1" : `Li'n falten ${missing}`}, però la línia li arriba a +${at} i la primera ${first === 0 ? 'ja hi és' : `és a +${first}`}.`,
    lostBingo: (at: number | null, end: number | null) => (at === null ? 'La quina no li arriba.' : end === null ? `La quina, a +${at}.` : `La quina, a +${at}: s'acaba a +${end}.`),
    /** The Desgraciat round. */
    standing: 'Dempeus',
    fallen: 'Ha caigut',
    fallsAt: (n: number, title: string) => `Cau a +${n} amb «${title}».`,
    neverFalls: 'Cap de les seves cançons no sona en aquesta quina.',
  },

  /** The Desgraciat round's Dempeus tab: who is still standing (PRIVATE, like the Futur). */
  standing: {
    word: 'dempeus',
    of: (total: number) => `de ${total} cartrons`,
    countLabel: (n: number, total: number | null) => (total === null ? `${n} dempeus` : `${n} dempeus de ${total} cartrons`),
    seated: (n: number) => (n === 1 ? '1 assegut' : `${n} asseguts`),
    bar: (n: number, total: number) => `${n} dempeus i ${total - n} asseguts`,
    listLater: `Quan en quedin ${STANDING_LIST_MAX} o menys, hi veuràs els números.`,
    list: 'Cartrons dempeus',
    chip: (id: number) => `#${id}`,
    fallen: (id: number) => `#${id} ha caigut`,
    /** The landing that knocked cards out: "−3 amb «Titanium»". */
    drop: (n: number, title: string | null) => (title ? `−${n} amb «${title}»` : `−${n}`),
    last: "L'últim dempeus",
    claimLast: (id: number) => `Comprovar #${id}`,
    lastNote: (id: number) => `Pregunteu qui té el #${id}. Si ningú el té, decidiu vosaltres.`,
    none: 'No en queda cap dempeus: decidiu vosaltres com acaba la quina.',
    noCards: "No hi ha cartrons en joc registrats: no es pot comptar qui queda dempeus.",
  },

  /** The Desgraciat's finale on stage (D161, D166–D168, D180–D187; the Consola-Desgraciat-Final board). */
  finale: {
    /** The claim slot in the Desgraciat round (D167): it opens the finalists' pad. */
    start: "Final a l'escenari",
    startNote: { normal: 'quan en quedin 5–10', medium: (n: number) => `en queden ${n}`, large: (n: number) => `en queden ${n}: pugeu-los` } satisfies Record<FinaleSize, unknown>,
    recommended: 'Recomanat',
    /** The claim slot once the finale is on: one finalist more («+ Finalista», D187). */
    add: 'Finalista',
    addNote: "un número més, si n'hi falta",
    /** The finalists' pad. */
    padLabel: 'Entrar els finalistes',
    padTitle: "Finalistes a l'escenari",
    padHint: 'el número de cada cartró, en pujar',
    display: 'Número de cartró',
    enter: 'Entra el número',
    close: 'Torna a la quina',
    closeNote: { start: 'tanca el teclat; la final no comença', add: 'tanca el teclat; no afegeix ningú' } satisfies Record<FinalePadMode, string>,
    begin: 'Començar final',
    /** The pad's big button during the finale: the new finalists join it. */
    join: 'Afegir a la final',
    count: (n: number) => (n === 1 ? '1 finalista' : `${n} finalistes`),
    needMore: (min: number) => `Calen com a mínim ${min} finalistes`,
    full: (max: number) => `Com a màxim ${max} finalistes`,
    chip: (id: number) => `#${id}`,
    removeChip: (id: number) => `Treu el #${id}`,
    card: (id: number) => `Cartró #${id}`,
    legend: '✓ no ha sonat · ✗ ha sonat',
    noCard: 'Sense el cartró a la tauleta: el portàtil el comprova en començar.',
    verdict: {
      standing: 'Dempeus: cap de les 12 ha sonat. Afegit.',
      unchecked: 'Afegit. El portàtil el comprova.',
      duplicate: 'Ja és a la final.',
    } satisfies Partial<Record<FinaleVerdict, string>>,
    /** A number that isn't added, in private, and why (D168). */
    refusal: {
      fallen: 'Ja ha caigut',
      unknown: 'Aquest cartró no existeix',
      notThisRound: "No és d'aquesta quina",
      comeBack: 'Un caigut no torna a dempeus: només «Enrere»',
    } satisfies Record<FinaleRefusal, string>,
    /** The Dempeus tab as the stage. */
    word: { onStage: "a l'escenari", standing: 'dempeus' } satisfies Record<FinaleTabView['word'], string>,
    countLabel: (n: number, word: string) => `${n} ${word}`,
    row: 'Els finalistes, en ordre',
    edit: 'Editar',
    addOne: 'Afegir',
    reversed: 'Al revés',
    remove: (id: number) => `Treu el #${id} de la final`,
    fallen: (id: number) => `#${id} ha caigut`,
    winner: (id: number) => `#${id} guanya`,
    saved: 'Salvats!',
    savedLabel: 'Salvats! La cançó és a tots els cartrons que queden: no compta per a ningú.',
    /** One left: the big button is the cue (D169: the fanfare waits for it). */
    celebrate: 'Celebrem!',
    celebrateNote: (id: number) => `el #${id} guanya · prem quan acabeu de parlar`,
    /** Enrere's note while the last landing's fallen are shown: it undoes the whole landing (D183). */
    backNote: 'els torna a dempeus',
    /** The ring and the next-song panel once the finale has its winner. */
    ringWinner: (id: number) => `Últim cartró dempeus · #${id}`,
    ringLabel: 'La final té guanyador: no aterra cap més cançó fins que premeu «Celebrem!»',
    nextDone: "Ja no n'aterra cap: la final s'ha acabat.",
  },

  hold: {
    title: 'En espera',
    reasons: {
      hold: 'Els presentadors parlen',
      back: "S'ha desfet l'última cançó",
      cancel: "S'ha cancel·lat el gir",
      end: "S'ha acabat la cua de cançons",
      music: "Música d'espera",
      claim: 'Comprovant un cartró',
      checkFailed: "Comprovació fallida: música d'error fins a «Reprèn»",
      discarded: 'Cartró descartat',
      pause: 'Torna de la pausa: Parlem',
    } satisfies Partial<Record<HoldReason, string>> as Partial<Record<HoldReason, string>>,
    reasonFallback: 'En espera',
    since: (clock: string) => `des de fa ${clock}`,
    holdMusicIn: (s: number) => `Música d'espera en ${s} s`,
    autoMusic: "Música d'espera automàtica",
    autoMusicNote: "Apagada, en una espera llarga la cançó continua baixa en lloc de canviar a música d'espera.",
    holdMusic: "Música d'espera",
    holdMusicOn: "Sona la música d'espera. «Reprèn» torna a les cançons.",
    resume: 'Reprèn',
  },

  pause: {
    title: 'Pausa',
    since: (clock: string) => `des de fa ${clock}`,
    note: 'El projector i els mòbils mostren «Tornem de seguida». Sona la música d\'espera.',
    end: 'Acaba la pausa',
    start: 'Pausa',
  },

  /** The presenter-paced Check (D107–D126; boards Consola-Comprovacio-Ritme, -Casos, -Revisio, -Desgraciada). */
  check: {
    /** "Cartró #57" (Londrina, in capitals by CSS). */
    card: (cardId: number) => `Cartró #${cardId}`,
    /** Spoken: the panel with the claimed card. */
    cardLabel: (cardId: number) => `Comprovació del cartró ${cardId}`,
    /** The claim's chip: "Línia", "Quina", and the Desgraciat round's "Desgraciada". */
    kind: { line: CA.line, bingo: CA.bingo, standing: 'Desgraciada' } satisfies Record<WinKind, string>,
    /** "1 de 2": this card among the claimed ones. */
    ofCards: (n: number, total: number) => `${n} de ${total}`,
    verdict: {
      complete: (kind: WinKind, row: number | null) =>
        kind === 'line' ? `Té línia: la fila ${(row ?? 0) + 1} és completa` : kind === 'bingo' ? 'Té quina: han sonat totes' : "Dempeus: no n'ha sonat cap",
      missing: (position: number, title: string) => `Falla a la ${ordinal(position)}: «${title}»`,
      fallen: (position: number, title: string) => `Ha caigut a la ${ordinal(position)}: «${title}»`,
      /** "és un cartró especial, i aquesta quina juga els normals" (the types' short names, lowercase). */
      wrongType: (cardType: string | null, roundType: string) =>
        cardType ? `Tipus erroni: és un cartró ${cardType}, i aquesta quina juga els ${roundType}s` : "Tipus erroni: és un cartró d'un altre tipus",
      unknownCard: 'Aquest cartró no existeix',
    },
    warnings: {
      notSold: 'No registrat com a venut',
      completeSince: (n: number, kind: WinKind) => (kind === 'standing' ? `L'únic dempeus des de la cançó ${n}` : `Complet des de la cançó ${n}`),
    },
    /** The verdict under the card, on a fail: a big ✗ and the word, beside the song that failed it. */
    failed: 'Fallada',
    nextTag: 'Següent',
    skipped: 'no es destaparà',
    /** A cell's spoken state. */
    cellLabel: (title: string, mark: 'ok' | 'bad' | null, revealed: boolean, kind: WinKind) =>
      mark === null ? title : `${title}: ${(mark === 'ok') === (kind !== 'standing') ? CA.landed.toLowerCase() : CA.notLanded.toLowerCase()}${revealed ? ', destapada' : ''}`,
    back: 'Enrere',
    backNote: 'treu una marca',
    review: 'Revisió manual',
    reviewNote: 'sense resultat',
    /** A card claimed too (D110): the claim pad. */
    add: 'Candidat',
    /** The next song inside «Destapa»: "ABBA · 2 de 3" (up to where the reveals stop). */
    nextLine: (artist: string, at: number, of: number) => [artist, `${at} de ${of}`].filter(Boolean).join(' · '),
    /** Spoken: the next song «Destapa» reveals. */
    nextLabel: (title: string, at: number, of: number) => `Ara destapes: ${title}, ${at} de ${of}`,
    /** After «Enrere» (D134): what sounds again, and «Seguides» off for this card. */
    backDone: (title: string | null, autoOff: boolean) =>
      `${title ? `Enrere: torna a sonar «${title}».` : "Enrere: torna la música d'abans de la comprovació."}${autoOff ? " «Seguides» s'ha apagat." : ''}`,
    /** «Seguides» (D107, D117): reveal in a row. */
    auto: {
      label: 'Seguides',
      off: "toca: una rere l'altra",
      on: 'toca: atura-les',
      cue: 'toca: fa el senyal sol',
      none: 'no hi ha res a destapar',
      yes: 'Sí',
      no: 'No',
    },
    /** The big button (ANIMATIONS.md › check-pace). */
    big: {
      reveal: 'Destapa',
      revealNote: 'toca: la següent cançó',
      revealing: 'Destapant…',
      revealingHeld: 'mentre mantens A, fins al senyal',
      revealingNote: 'fins al senyal · toca: atura-les',
      /** Its strip: holding A reveals in a row. */
      strip: 'Mantén: seguides',
      celebrate: 'Celebrem!',
      celebrateNote: 'prem quan acabeu de parlar',
      celebrateFor: (ids: readonly number[]) => `${listing(ids.map((id) => `el #${id}`))} ${ids.length === 1 ? 'ha' : 'han'} guanyat · prem quan acabeu de parlar`,
      validNext: 'Vàlid · següent',
      validNextNote: 'sense fanfàrria: la festa, en acabar',
      fail: 'Fallada',
      failNote: 'prem quan acabeu de parlar',
      /** Between two cards: the next one comes on screen by itself. */
      cuedPass: 'Vàlid',
      cuedFail: 'Fallat',
      cuedNote: 'el següent cartró entra sol',
    },
    claims: 'Cartrons cantats',
    /** The claimed cards' chips. */
    status: {
      queued: 'A la cua',
      checking: 'Comprovant',
      reviewing: 'En revisió',
      valid: 'Vàlid',
      invalid: 'Fallat',
      discarded: 'Descartat',
    } satisfies Record<ClaimStatus, string>,
    checkNow: (id: number) => `Comprova el #${id}`,
    /** No Check on screen (after a Back during a Check, U104): the queued cards wait for a press. */
    none: 'Cap cartró a la pantalla: trieu quin voleu comprovar.',
  },

  /** The Review («Revisió manual», D119–D125; board Consola-Comprovacio-Revisio, a draft: U77). */
  review: {
    nowPlaying: CA.nowPlaying,
    chip: (cardId: number) => `En revisió · #${cardId}`,
    continue: 'Continua la comprovació',
    continueNote: (title: string | null) => (title ? `torna a destapar on era: la següent és «${title}»` : 'torna a destapar on era'),
    win: 'Dona-la per bona',
    winNote: 'a mà: la fanfàrria i la celebració',
    lose: 'Dona-la per dolenta',
    loseNote: 'a mà: el moment de fallada',
    discard: 'Descarta el cartró',
    discardNote: "sense fanfàrria ni fallada; torna la música d'abans",
    /** The triangle on a decision against the card. */
    against: 'va contra el cartró',
    confirm: {
      title: { win: 'Dona-la per bona?', lose: 'Dona-la per dolenta?' },
      warnWin: (missing: string | null) => (missing ? `El cartró no passa: hi falta «${missing}».` : 'El cartró no passa.'),
      warnLose: (kind: WinKind) => (kind === 'standing' ? "El cartró passaria: no n'ha sonat cap." : 'El cartró passaria: han sonat totes.'),
      text: {
        win: 'Les cançons que queden no es destapen: sonen la fanfàrria i la celebració, com si hagués passat. Al registre hi consta com a decisió a mà.',
        lose: 'Les cançons que queden no es destapen: sona el moment de fallada, com si hagués fallat. Al registre hi consta com a decisió a mà.',
      },
      cancel: 'Torna a la revisió',
      yes: { win: 'Sí, dona-la per bona', lose: 'Sí, dona-la per dolenta' },
    },
  },

  celebration: {
    /** The presenters' own label for the win (the screens shout nothing in the Desgraciat round). */
    title: { line: 'LÍNIA!', bingo: 'QUINA!', standing: 'Últim cartró dempeus' } satisfies Record<WinKind, string>,
    cards: (ids: readonly number[]) => (ids.length === 1 ? CA.card(ids[0]) : `Cartrons ${ids.join(', ')}`),
    winningSong: (title: string) => `Cançó guanyadora: ${title}`,
    music: 'Música de celebració',
    choices: { winningSong: 'Cançó guanyadora', victory: 'Victòria', holdMusic: 'Música de fons' } satisfies Record<CelebrationMusic, string>,
    suggested: 'suggerida',
    musicForLater: 'Si el cartró és bo, la celebració començarà amb aquesta música.',
    continueLine: 'Prem «Següent» per continuar la quina.',
    toInterval: 'Passa al descans',
    toIntervalNote: "També hi passa sola al cap d'una estona.",
    lastRound: "Era l'última quina: acabeu la nit des del menú.",
    winnersTitle: 'Guanyadors',
  },

  winnerForm: {
    name: 'Nom (opcional)',
    /** The numbered slip handed to a winner instead of (or as well as) taking a name. */
    slip: 'Número de butlleta (opcional)',
    notes: 'Notes',
    save: 'Desa',
    saved: 'Desat',
    privacy: 'Privat: només a la consola i a les dades del núvol.',
    edit: 'Edita',
    close: 'Tanca',
  },

  winnersList: {
    /** A winner known by the numbered slip they were given. */
    slip: (n: string) => `Butlleta ${n}`,
    title: CA.winners,
    empty: 'Encara no hi ha guanyadors.',
    item: (kind: WinKind, cardId: number) => `${kindLabel[kind]} · ${CA.card(cardId)}`,
    noName: 'Sense nom',
  },

  interval: {
    title: CA.scene.interval,
    guide: 'Compte enrere orientatiu',
    over: (clock: string) => `+${clock}`,
    /** The cluster's big button in a break (D195), A's default. */
    start: 'Comença la quina',
    startNote: 'primer anuncieu els premis',
  },

  /** «Ara sona» with the playlist of the breaks, Pausa or the end (IntervalMusic; D196: the left column's top). */
  intervalMusic: {
    title: CA.nowPlaying,
    sets: { breaks: 'Música del descans', pausa: 'Música de la pausa', end: 'Música del final' } satisfies Record<MusicSet, string>,
    position: (set: string, index: number, count: number) => `${set} · cançó ${index} de ${count}`,
    waiting: 'Encara sona la música anterior; la llista entra tot seguit.',
    skip: 'Salta la cançó',
    /** D228: in a break, which set plays (`intervalSet`); each break starts on the breaks' own. The picker's name
     *  (spoken), and its two options, short: the line above already says «Música del descans» or «… de la pausa». */
    pick: 'Música que sona',
    picks: { breaks: 'Descans', pausa: 'Pausa' } satisfies Record<BreakSet, string>,
  },

  /** «Ara sona» in one line, over the pads, Cerca and the Check board (NowLine; D196, D199). */
  nowLine: {
    label: CA.nowPlaying,
    low: "baixa, d'abans de la comprovació",
    /** Spoken, the whole line. */
    aria: (what: string, low: boolean) => `${CA.nowPlaying}${low ? ', baixa' : ''}: ${what}`,
  },

  /**
   * «Llançament» and «Tempesta» (logic/throw-songs.ts; the Consola-Llancament-Tempesta board). The storm's name is
   * provisional (U137).
   */
  throws: {
    names: {
      throw: { label: 'Llançament', sub: null, start: 'toca: sona el llançament', replace: 'toca: canvia al llançament', stopped: (where: string, at: string) => `${where} · el llançament, aturat a ${at}` },
      storm: { label: 'Tempesta', sub: 'de blat de moro', start: 'toca: sona la tempesta', replace: 'toca: canvia a la tempesta', stopped: (where: string, at: string) => `${where} · la tempesta, aturada a ${at}` },
    } satisfies Record<ThrowSong, { label: string; sub: string | null; start: string; replace: string; stopped: (where: string, at: string) => string }>,
    /** A tap while it plays, and while a tap has stopped it. */
    stop: 'toca: atura',
    resume: 'toca: continua',
    /** The hold, on its strip (or over the whole button in the top row). */
    restart: 'Des del principi',
    /** Spoken: what each gesture does. */
    howTo: (tap: string) => `${tap}; mantén per tornar a començar des del principi`,
    /** While it's on: its time from the hook, and its length (the button's bar). */
    time: (at: string, total: string) => `${at} de ${total}`,
    drop: 'Drop',
    /** The music panel while a throw song plays over the set's music. */
    nowPlaying: CA.nowPlaying,
    under: (title: string) => `A sota, «${title}»: torna a pujar quan s'acabi.`,
    underWaiting: "A sota, la música: torna a pujar quan s'acabi.",
  },

  /** The volume sliders, in the menu (logic/volumes.ts; D139, D157–D159). */
  volumes: {
    title: 'Volums',
    note: 'Del 0 al 150%. La marca de cada barra és on comença. Es desen per a tota la nit.',
    groups: { general: 'General', songs: 'Cançons', music: 'Música de cada moment', moments: 'Moments forts', effects: 'Efectes' } satisfies Record<VolumeGroup, string>,
    keys: {
      master: { label: 'General', note: 'Tot el so alhora' },
      songs: { label: 'Cançons', note: 'Les cançons de la quina' },
      songsParlem: { label: 'Cançons amb Parlem', note: 'La cançó baixa mentre parleu' },
      check: { label: 'Comprovació', note: 'Els trossos de cançó i el disc ratllat' },
      doors: { label: "Música d'entrada", note: 'Mentre es venen els cartrons' },
      intros: { label: 'Presentació de cada quina', note: null },
      breaks: { label: 'Música del descans', note: null },
      pausa: { label: 'Música de la pausa', note: null },
      holdMusic: { label: "Música d'espera", note: "Quan Parlem s'allarga" },
      end: { label: 'Música del final', note: null },
      voices: { label: 'Veus', note: "El nom de cada quina, el compte enrere de les portes i l'avís del descans" },
      throws: { label: 'Llançament i tempesta', note: 'Un sol control per als dos; més forts que les cançons' },
      win: { label: 'Victòria', note: 'La fanfàrria, la música de victòria i la cançó guanyadora' },
      fail: { label: 'Fallada', note: "La fanfàrria i la música d'error" },
      finalLap: { label: '«Última volta»', note: 'La fanfàrria' },
      djFx: { label: 'Efectes de DJ', note: 'Pujades, cops i xiulets de les transicions' },
      padFx: { label: 'Efectes', note: 'La pestanya Efectes' },
      ticks: { label: 'Bombo', note: 'Els tics mentre gira' },
    } satisfies Record<VolumeKey, { label: string; note: string | null }>,
    /** «80%», no space (the user, #62). */
    value: (percent: number) => `${percent}%`,
    /** Spoken with each slider, and on its default's mark. */
    defaultValue: (percent: number) => `Per defecte: ${percent}%`,
    /** The − and + at a slider's ends: 1% a press (#61). */
    less: (label: string) => `${label}: baixa 1%`,
    more: (label: string) => `${label}: puja 1%`,
  },

  roundStart: {
    announce: 'Premis per anunciar',
    shuffle: 'Barreja',
    shuffling: (s: number) => `Barrejant… ${s} s`,
    shuffled: 'Barrejat. Prem «Següent» per a la primera cançó.',
    shuffleNote: 'Quan hàgiu anunciat els premis.',
  },

  before: {
    title: CA.scene.before,
    startAt: (clock: string) => `Inici previst: ${clock}`,
    howToStart: 'Per començar la nit: Menú → Començar la nit.',
  },

  after: { title: 'Final de la nit', note: CA.thanks },

  prizes: {
    line: CA.prize.line,
    bingo: CA.prize.bingo,
    standing: CA.prize.standing,
    desgraciat: CA.desgraciatRound,
    sponsoredBy: CA.sponsoredBy,
    /** The ticket's ribbon ("LÍNIA", "QUINA"; drawn in capitals). */
    ribbon: kindLabel,
    none: 'Sense premi',
    special: CA.specialRound,
    noPlan: "Encara no hi ha pla de la nit: deseu-lo des de l'Admin.",
    /** With the round's name (plan.ts roundTitle). */
    noRound: (name: string) => `El pla no té la ${name}.`,
    secret: 'Secrets: els mòbils encara no els veuen',
    reveal: 'Revelar premis',
    revealed: 'Revelats: els mòbils ja els veuen',
  },

  tabs: { label: 'Ajudes', state: 'Estat', standing: 'Dempeus', search: 'Cerca', future: 'Futur', prizes: 'Premis', effects: 'Efectes' },

  cheatSheet: {
    /** "Premis de la Quina 4", with the round's name (plan.ts roundTitle). */
    prizes: (name: string) => `Premis de la ${name}`,
    specialRules: CA.specialRound,
    claimRules: 'Normes per cantar',
    keys: 'Tecles del portàtil (pla B)',
    checklist: 'Preparació',
  },

  /** The laptop's Plan B keys, from the mixer README's "Show keys". */
  showKeys: [
    { keys: '→ / Retorn', action: 'Següent (no durant Aguanta ni el suspens)' },
    { keys: '←', action: 'Enrere' },
    { keys: 'Espai', action: 'Parlem / Reprèn' },
    { keys: 'S', action: 'Suspens' },
    { keys: 'M', action: "Música d'espera" },
    { keys: 'Esc', action: 'Pànic' },
    { keys: '+ / −', action: 'Ritme ±1 s' },
    { keys: 'L', action: 'Bloqueja el ritme' },
    { keys: 'A', action: 'Avanç automàtic' },
    { keys: '0–4', action: 'Fase: automàtica, inici, mig, tardana, final' },
    { keys: 'D', action: 'Informació de depuració' },
    { keys: 'H', action: 'Amaga els controls (projector)' },
    { keys: '[ / ]', action: 'Desfasament de pantalla ±5 ms' },
  ] as const,

  checklist: [
    { id: 'hotspot', text: "Apagada automàtica del punt d'accés desactivada" },
    { id: 'charger', text: "Mòbil del punt d'accés al carregador" },
    { id: 'autolock', text: 'Bloqueig automàtic de la tauleta: mai' },
    { id: 'reach', text: "Portàtil i tauleta provats al punt d'accés de debò" },
    { id: 'resumeCode', text: 'A cada barreja, codi de recuperació apuntat (menú › Recuperar el show)' },
    { id: 'tabletClicks', text: 'Prova de so: els clics de la tauleta no se senten pels micròfons oberts (si se senten, menú › Sons de la tauleta)' },
  ] as const,

  sounds: {
    stingers: 'Fanfares',
    effects: 'Efectes',
    names: {
      'mkwii-final-lap': 'Última volta',
      'mkwii-mission-clear': 'Missió complerta',
      'mkwii-mission-failure': 'Missió fallida',
      'mkwii-low-place-fanfare': 'Fanfara de cua',
      'among-us': 'Among Us',
      'anime-wow': 'Anime wow',
      boom: 'Bum',
      'bum-bum-buaaa': 'Bum bum buaaa',
      buzzer: 'Brunzidor',
      correct: 'Correcte',
      'duck-quack': 'Ànec',
      'fear-melody': 'Por',
      heaven: 'Cel',
      horn: 'Botzina',
      'metal-gear-alert': 'Alerta',
      'orchestra-hit': "Cop d'orquestra",
      'sad-trombone': 'Trombó trist',
      'spongebob-boowomp': 'Boowomp',
      'spongebob-fail': 'Fracàs',
      tada: 'Tatxan!',
    } satisfies Partial<Record<SoundName, string>> as Partial<Record<SoundName, string>>,
  },

  /** The claim pad (D110, D126; boards Consola-Comprovacio-Ritme ①, -Casos ⑤). */
  numpad: {
    label: 'Cantar cartrons',
    title: 'Qui ha cantat?',
    same: 'tots els números, el mateix premi',
    kind: 'Què canta?',
    kinds: kindLabel,
    display: 'Número de cartró',
    keypad: 'Teclat del número',
    chip: (id: number) => `#${id}`,
    removeChip: (id: number) => `Treu el #${id}`,
    unknown: 'Aquest cartró no existeix',
    unknownChip: 'no existeix',
    back: 'Esborra',
    /** D164: it closes the number entry and goes back to the round's screen. */
    cancel: 'Torna a la quina',
    add: 'Candidat',
    full: (n: number) => `Com a màxim ${n} cartrons alhora`,
    moreTitle: 'Algú més?',
    moreText: "Pregunteu-ho mentre aneu cap al cartró. Cada número és un xip; es comproven seguits, en aquest ordre. Si algú crida durant la comprovació, «+ Candidat» encara l'afegeix.",
    submit: (ids: readonly number[]) => (ids.length === 0 ? 'Comprovar' : ids.length === 1 ? `Comprovar el #${ids[0]}` : `Comprovar ${ids.length} cartrons`),
    submitNote: (kind: WinKind, ids: readonly number[]) => [kindLabel[kind], ids.length ? listing(ids.map((id) => `#${id}`)) : null].filter(Boolean).join(' · '),
  },

  /** The Wii remote (optional, paired with the laptop): the menu's row, the Comandament dialog, the badges. */
  wii: {
    title: CA.wii.title,
    status: { connected: 'Connectat', connecting: 'Connectant…', disconnected: 'Desconnectat', lost: "S'ha desconnectat", unsupported: 'No disponible aquí' } satisfies Record<WiiStatus, string>,
    connect: 'Connectar',
    open: 'Veure el comandament',
    close: 'Tancar',
    connectNote: "Aparelleu-lo abans amb el Bluetooth del portàtil; després, «Connectar» i trieu-lo a la llista.",
    unsupportedNote: 'Aquest navegador no pot connectar el comandament. Es connecta a la consola oberta amb Chrome al portàtil, on està aparellat.',
    demo: 'Comandament de prova (només en desenvolupament)',
    /** The remote is connected to another console (the laptop's): this one shows it, it can't connect it. */
    elsewhere: "Connectat a la consola del portàtil.",
    battery: (level: number) => `Bateria ${Math.round(level * 100)} %`,
    batteryLow: 'Queda poca bateria: canvieu les piles al descans.',
    /** The remote's range (wii/drops.ts): how often it dropped lately. */
    drops: (n: number) => (n === 1 ? "1 caiguda en els últims 10 minuts" : `${n} caigudes en els últims 10 minuts`),
    dropsWarn: "S'ha desconnectat sovint: acosteu-vos al portàtil o tingueu la tauleta a mà.",
    /** The shake gesture's switch (D144, D148), in the menu and on the dialog's shake row. */
    shake: CA.wii.shake.switchLabel,
    shakeNote: CA.wii.shake.switchNote,
    shakeDefault: CA.wii.shake.switchDefault,
  },

  menu: {
    title: 'Menú',
    /** Under the title: this device and the round ("Tauleta · Quina 3 de 8": S.roundOf). */
    subtitle: (label: string | null, round: string | null) => [label, round].filter(Boolean).join(' · '),
    close: 'Tanca',
    device: 'Aquest dispositiu',
    labelField: 'Nom del dispositiu',
    labelSave: 'Desa',
    labelNote: 'Les ordres porten el nom nou quan es torna a carregar la pàgina. El nom diu qui ha premut cada botó.',
    theme: 'Tema',
    themes: { light: 'Clar', dark: 'Fosc' } satisfies Record<Theme, string>,
    /** This tablet's touch sounds (U182), beside the volume sliders. */
    uiSounds: 'Sons de la tauleta',
    uiSoundsNote: 'Clics suaus en tocar els botons, només en aquesta tauleta. La música no canvia.',
    uiSoundsLaptop: 'Al portàtil del show, sempre en silenci: el seu so va als altaveus.',
    night: 'La nit',
    start: 'Començar la nit',
    startNote: 'Presenta la Quina 1 al projector.',
    started: 'La nit ja ha començat',
    end: 'Acabar la nit',
    endNote: 'Mantén premut · passa al final de la nit',
    roundsTotal: 'Quines en total',
    roundsMinus: 'Una quina menys',
    roundsPlus: 'Una quina més',
    gameEnd: 'Final previst de la nit',
    game: 'Joc',
    pause: 'Pausa',
    pauseNote: 'Projector i mòbils: «Tornem de seguida»',
    phase: 'Fase',
    phaseAuto: 'Automàtica',
    winners: CA.winners,
    planB: 'Xuleta del pla B',
    planBNote: 'Tecles del portàtil i preparació',
    tools: 'Eines',
    confirmLine: 'Confirmar la línia sense comprovació',
    confirmLineNote: "Mantén premut · només si no s'ha pogut comprovar",
    danger: 'Pànic i final de la nit',
    panic: 'Pànic',
    panicNote: 'Mantén premut: silencia-ho tot al moment',
    wiiNote: "S'aparella al portàtil, no aquí. És opcional: la consola fa tot el que fa el comandament.",
    lan: 'Obre la consola en un altre mòbil',
    lanNote: "Escanegeu-lo amb un mòbil connectat al mateix punt d'accés.",
    lanLocalhost: "Obriu aquesta consola amb l'adreça IP del portàtil perquè el codi serveixi en un altre dispositiu.",
    lanLabel: 'Mòbil admin',
  },

  /** The menu's «Sons automàtics» (D237; AutoSounds.svelte): each sound the show plays by itself, on or off. */
  autoSounds: {
    title: 'Sons automàtics',
    note: "Els sons que el show fa sol. Apagat, no sona encara que la barra de volum estigui alta. Es desa per a tota la nit.",
    keys: {
      drumTicks: { label: 'Tics del bombo', note: 'Els clics mentre el bombo gira' },
      djFx: { label: 'Efectes de DJ', note: 'Pujades, cops i xiulets de les transicions entre cançons' },
      finalLap: { label: '«Última volta»', note: "La fanfàrria, un cop per quina, quan arriba l'última volta. Des d'Efectes es pot tocar igualment" },
      winFanfare: { label: 'Fanfàrria de victòria', note: 'La fanfàrria i el cop quan es confirma un premi' },
      failFanfare: { label: 'Fanfàrria de fallada', note: "Quan la comprovació d'un cartró falla" },
      voices: { label: 'Veus', note: "El nom de cada quina, el compte enrere de les portes i l'avís del descans" },
    } satisfies Record<AutoSound, { label: string; note: string }>,
  },

  /** The PA's sound test (D229; SoundTest.svelte): each kind in turn, on a loop at its slider's level. */
  soundTest: {
    title: 'Prova de so',
    note: 'Per ajustar els altaveus: cada so sona en bucle al seu volum; moveu-ne la barra mentre sona.',
    start: 'Comença la prova',
    /** Under the start button while the test can't run (`soundTest` is only allowed in `before`). */
    unavailable: 'Només abans de la primera quina, amb res sonant.',
    playing: 'Sona ara',
    position: (n: number, count: number) => `${n} de ${count}`,
    /** On a step whose automatic sound is off (D237): the test plays it anyway, the night won't. */
    autoOff: 'apagat a Sons automàtics',
    prev: 'Anterior',
    next: 'Següent',
    stop: 'Atura la prova',
    /** What each kind plays in the test. */
    plays: {
      songs: 'Trossos de cançons, com a la quina',
      songsParlem: 'Trossos de cançons, baixos com amb Parlem',
      check: 'Trossos de cançó, com a la comprovació',
      intros: 'La música de presentació de cada quina',
      breaks: 'La llista del descans',
      pausa: 'La llista de la pausa',
      holdMusic: "La música d'espera",
      end: 'La llista del final',
      voices: 'Una frase de les portes, amb la campaneta',
      throws: 'La cançó del llançament',
      win: 'La música de victòria, amb la fanfàrria',
      fail: 'La música de fallada, amb la fanfàrria',
      finalLap: "La fanfàrria de l'última volta",
      djFx: 'Una pujada i un cop',
      padFx: "Els efectes de la pestanya Efectes, l'un rere l'altre",
      ticks: 'Una ràfega de tics del bombo',
    } satisfies Record<SoundTestKind, string>,
  },

  /** «Cartrons venuts» in the menu (D234; CardsAdd.svelte): add the cards sold on the night to the cards in play. */
  cardsAdd: {
    title: 'Cartrons venuts',
    inPlay: (count: number) => (count === 1 ? '1 cartró en joc' : `${count} cartrons en joc`),
    none: 'Encara no hi ha cap cartró en joc.',
    field: 'Afegeix cartrons venuts',
    placeholder: '400-450, 452',
    hint: 'Un interval (400-450) o números solts, separats per comes.',
    add: 'Afegeix',
    preview: (count: number, ranges: string, already: number) =>
      `${count === 1 ? `S'hi afegirà el ${ranges}` : `S'hi afegiran ${count} cartrons: ${ranges}`}${already ? ` · ${already === 1 ? '1 ja hi era' : `${already} ja hi eren`}` : ''}`,
    error: {
      token: (token: string) => `«${token}» no és ni un número ni un interval`,
      tooLarge: (token: string) => `«${token}» és un interval massa gran`,
      unknown: (ranges: string, count: number) => (count === 1 ? `El ${ranges} no és cap cartró imprès` : `No són cartrons impresos: ${ranges}`),
      already: 'Ja són tots en joc',
      tooLong: "La llista de cartrons en joc ja no hi cap: afegiu-los des de l'Admin",
      refused: "El show no els ha acceptat: torneu-ho a provar o afegiu-los des de l'Admin",
    },
    /** The Notice once the engine has merged them (`cards.lastAdd`): what joined, what was in already (another console
     *  may have added them a moment before), and the cards in play now. */
    done: (added: { count: number; ranges: string }, already: { count: number; ranges: string }, total: number) => {
      const was = already.count === 1 ? `el ${already.ranges} ja hi era` : `${already.count} ja hi eren (${already.ranges})`;
      if (added.count === 0) return `${already.count === 1 ? `El ${already.ranges} ja hi era` : `Ja hi eren tots: ${already.ranges}`}. N'hi ha ${total} en joc.`;
      const joined = added.count === 1 ? `Afegit el ${added.ranges}` : `Afegits ${added.count} cartrons (${added.ranges})`;
      return `${joined}${already.count ? `; ${was}` : ''}. Ara n'hi ha ${total} en joc.`;
    },
  },

  resume: {
    title: 'Recuperar el show',
    current: 'Codi de recuperació de la quina',
    currentNote: "Apunteu-lo a cada barreja i guardeu-lo com la caixa dels cartrons. Amb aquest codi, un altre portàtil continua la quina on era.",
    reveal: 'Mostra els codis',
    hide: 'Amaga els codis',
    none: 'Encara no hi ha codi: apareix quan es barreja la primera quina.',
    field: 'Codi per recuperar',
    placeholder: 'Q3N-4K7XM2P-17-S41',
    useSaved: 'Fes servir el darrer codi desat',
    invalid: 'Aquest codi no és vàlid. Ha de ser com Q3N-4K7XM2P-17-S41.',
    preview: (round: string, counted: number, title: string | null) =>
      counted === 0
        ? `${round}: encara no ha comptat cap cançó.`
        : `${round}: ${counted} cançons comptades. L'última: ${title ?? 'cançó desconeguda'}.`,
    lineFrom: (song: number) => `Línia confirmada (la quina comptava des de la cançó ${song}).`,
    send: 'Recuperar el show',
    sendNote: 'Mantén premut. El portàtil reconstrueix la quina i es queda en espera.',
    notNow: "Només es pot recuperar abans de començar, en un descans o al final, i amb el portàtil connectat.",
  },

  toast: {
    region: 'Avisos',
    close: 'Tanca',
    notSent: (cmd: string) => `${cmd}: no s'ha enviat, no hi ha connexió`,
    rejected: (cmd: string, reason: string) => `${cmd}: ${reason}`,
  },

  reasons: {
    invalid: 'ordre no vàlida',
    locked: 'la pàgina del show encara espera el primer clic',
    busy: 'ja hi ha un gir en marxa',
    endOfQueue: "s'ha acabat la cua de cançons",
    nothingToUndo: 'no hi ha res per desfer',
    notHolding: 'no està en espera',
    notReady: 'encara no està a punt',
    decodeFailed: "no s'ha pogut carregar la cançó",
    planFailed: "no s'ha pogut preparar la transició",
    unknownSfx: 'so desconegut',
    unknownCommand: 'el motor encara no coneix aquesta ordre',
    noSuspense: 'no hi ha cap suspens obert',
    wrongScene: 'ara no es pot fer',
    unknownClaim: 'aquest cartró cantat no existeix',
    cannotResume: 'no es pot recuperar amb aquest codi: revisa la quina, la llavor i la cançó',
    claimOpen: 'hi ha un cartró en revisió: decidiu-lo primer',
    unknownCard: 'aquest cartró no existeix',
    nextBlocked: 'deixeu anar Aguanta o el Suspens primer',
    finaleDecided: 'la final ja té guanyador: feu el senyal',
  } satisfies Partial<Record<RejectReason, string>> as Partial<Record<RejectReason, string>>,
  reasonFallback: "l'ordre no s'ha acceptat",

  commands: {
    next: 'Següent',
    back: 'Enrere',
    hold: 'Parlem',
    holdMusic: "Música d'espera",
    suspense: 'Suspens',
    setPace: 'Ritme',
    setGame: 'Configuració',
    confirmLine: 'Confirmar línia',
    newRound: 'Barrejar',
    panic: 'Pànic',
    sfx: 'So',
    roundIntro: 'Començar quina',
    claim: 'Comprovar cartró',
    checkStart: 'Comprovar',
    checkNext: 'Destapa',
    checkBack: 'Enrere',
    checkAuto: 'Seguides',
    checkReview: 'Revisió manual',
    reviewEnd: 'Decisió de la revisió',
    winnerInfo: 'Dades del guanyador',
    celebrationMusic: 'Música de la celebració',
    interval: 'Descans',
    endGame: 'Acabar la nit',
    pause: 'Pausa',
    intervalSkip: 'Saltar cançó',
    setVolume: 'Volum',
    throw: 'Llançament',
    storm: 'Tempesta',
    resumeAt: 'Recuperar el show',
    revealPrizes: 'Revelar premis',
    finale: 'Finalistes',
    finaleCue: 'Celebrem!',
    getUpcoming: 'Les properes cançons',
    intervalSet: 'Música del descans',
    setAutoSound: 'Sons automàtics',
    soundTest: 'Prova de so',
    addCardsInPlay: 'Cartrons venuts',
    twoLevelHold: 'Parlem o Aguanta',
  } satisfies Record<ConsoleCommand, string> as Partial<Record<AnyCommandName, string>>,
  commandFallback: 'Ordre',

  icons: { cover: 'Portada' },
};

/** The text for a hold reason. */
export const holdReasonText = (reason: HoldReason | string): string => S.hold.reasons[reason as HoldReason] ?? S.hold.reasonFallback;
/** The label of a command, for toasts. */
export const commandText = (cmd: string | null): string => (cmd ? S.commands[cmd as AnyCommandName] : undefined) ?? S.commandFallback;
/** The Catalan reason of a rejection. */
export const reasonText = (reason: RejectReason | string): string => S.reasons[reason as RejectReason] ?? S.reasonFallback;
/** A sound's button label. */
export const soundText = (name: SoundName): string => S.sounds.names[name] ?? name.replace(/^mkwii-/, '').replaceAll('-', ' ');
