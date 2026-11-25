// Every word the console shows, in Catalan. Shared terms come from ui/i18n/ca.ts so every screen says them
// the same way; this file holds the console's own copy. Components never inline text: they read it here.
// Maps keyed by protocol vocabulary are Partial with a fallback, so a new reason or command from the engine
// shows something sensible instead of breaking the build; tests/ui/console/strings.test.ts checks that
// every known value has its own text.
import type { HoldReason, PhaseName, RejectReason, ShowStatus, SoundName } from '@quina/protocol';
import { CA } from '../../packages/ui/i18n/ca.ts';
import type { AnyCommandName, CelebrationMusic, CheckOutcome, ClaimStatus, WinKind } from '../../packages/ui/flow.ts';
import type { HeaderChip, LinkName, LinkState } from './logic/status.ts';
import type { RecoveryNotice } from './logic/pace-panel.ts';
import type { ChartGap } from './logic/future.ts';
import { STANDING_LIST_MAX } from '@quina/protocol';
import type { ConsoleCommand, Theme } from './config.ts';
import type { WiiStatus } from './wii/controller.svelte.ts';

export { CA };

const seconds = (s: number) => `${s} s`;
const kindLabel: Record<WinKind, string> = { line: CA.line, bingo: CA.bingo, standing: CA.standing };
/** "línia" or "quina", inside a sentence. */
const kindWord: Record<WinKind, string> = { line: 'línia', bingo: 'quina', standing: 'últim dempeus' };
/** "A, B i C". */
const listing = (items: readonly string[]) => (items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} i ${items[items.length - 1]}`);

export const S = {
  pageTitle: 'Consola · Quina Musical',

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
    round: (n: number, special: boolean, desgraciat = false) => (desgraciat ? CA.desgraciatRound : special ? `${CA.round(n)} · especial` : CA.round(n)),
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
    next: 'Següent',
    talk: 'Parlem',
    talkNote: 'toca: la música baixa',
    stay: 'Aguanta',
    stayNote: 'toca: la cançó segueix',
    /** A pressed Parlem or Aguanta: pressing it again releases the Hold. */
    activeNote: 'prem per reprendre',
    /** The second levels, reached by holding Parlem or Aguanta. */
    pauseLevel: 'Pausa',
    suspense: 'Suspens',
    /** On the second-level strip: hold the button to get there. */
    holdFor: 'mantén',
    /** Spoken: what holding the button does. */
    holdForLong: (level: string) => `Mantén premut per passar a ${level}`,
    /** The second level is on: a tap leaves it. */
    pauseOn: 'en pausa · toca per tornar',
    suspenseOpen: 'deixa anar per aterrar',
    suspenseTap: 'toca per aterrar',
    suspenseAutoRelease: (s: number) => `s'allibera sol en ${s} s`,
    back: 'Enrere',
    /** Under "Enrere" in its narrow button: just "hold, don't tap". */
    backHint: 'mantén',
    claim: 'Comprovar cartró',
  },

  longPress: { hint: 'Mantén premut per confirmar', percent: (p: number) => `${p} %` },

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
        manual: 'Avanç automàtic aturat: prem Següent',
        manualFinal: 'Fase final: sense avanç automàtic. Prem Següent',
        lastStanding: "Només en queda un dempeus: comproveu-lo",
        held: 'En espera: sense avanç automàtic',
        checking: 'En espera: comprovant un cartró',
        checkFailed: "En espera: música d'error fins a Reprèn",
        paused: 'Pausa tècnica',
        waiting: 'Esperant «Següent»',
      },
      badge: { auto: 'Avança sol', autoOff: 'Avanç automàtic aturat', final: 'Fase final', talk: 'Parlem', stay: 'Aguanta', held: 'En espera' },
      chip: {
        spinning: (s: number | null) => (s === null ? 'Girant' : `Girant · aterra en ${s} s`),
        suspense: 'Suspens obert · deixa anar per aterrar',
        manual: 'Manual · prem «Següent»',
        manualFinal: 'Fase final · prem «Següent»',
        lastStanding: (cardId: number | null) => (cardId === null ? "Últim dempeus · comprova'l" : `Últim dempeus · comprova el #${cardId}`),
        talk: (since: string) => `Parlem · des de fa ${since}`,
        stay: (since: string) => `Aguanta · des de fa ${since}`,
        checking: (cardId: number | null) => (cardId === null ? 'Comprovant un cartró' : `Comprovant el cartró #${cardId}`),
        checkFailed: 'Cap cartró vàlid · prem «Reprèn»',
        paused: (since: string) => `Pausa tècnica · des de fa ${since}`,
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
    /** A preset button's accessible name ("Ràpid, 14 s, recomanat"). */
    presetLabel: (name: string | null, s: number, recommended: boolean) => [name, `${s} s`, recommended ? 'recomanat' : null].filter(Boolean).join(', '),
    recovery: ({ direction, seconds: s }: RecoveryNotice) =>
      direction === 'faster'
        ? `Recuperant l'horari: cada cançó dura ${s > 0 ? `${s} s` : 'una mica'} menys.`
        : `Anem avançats: cada cançó dura ${s > 0 ? `${s} s` : 'una mica'} més.`,
  },

  future: {
    hiddenNote: 'Què passarà a les properes cançons. Amagat perquè també us agafi per sorpresa.',
    show: 'Mirar el futur',
    hide: 'Amagar',
    chart: 'Cartrons segons les cançons marcades',
    bar: (marked: number) => (marked === 1 ? '1 marcada' : `${marked} marcades`),
    barLabel: (marked: number, cards: number) => `${cards} ${cards === 1 ? 'cartró' : 'cartrons'} amb ${marked} ${marked === 1 ? 'cançó marcada' : 'cançons marcades'}`,
    validCount: (n: number) => `${n} cartrons en joc en aquesta quina`,
    gaps: {
      cards: 'Falten els cartrons impresos (cards.json).',
      inPlay: 'No hi ha cartrons en joc registrats.',
      landings: "Aquesta consola no ha vist totes les cançons d'aquesta quina.",
    } satisfies Record<ChartGap, string>,
    unknown: '—',
    firstLine: 'Primera línia',
    bingo: 'Quina',
    now: 'Ja hi és',
    done: 'Confirmada',
    atLeast: (n: number) => `com a mínim d'aquí a ${n}`,
    inSongs: (n: number) => (n === 1 ? 'La següent cançó' : `D'aquí a ${n} cançons`),
    never: 'Cap en aquesta quina',
    exactPending: "El número exacte necessita l'ordre de la cua, i el motor encara no l'envia a la consola.",
    winners: 'Possibles guanyadors',
    none: 'Encara cap',
    kind: kindLabel,
    rows: (rows: readonly number[]) => (rows.length === 1 ? `fila ${rows[0]}` : `files ${rows.join(', ')}`),
    completedBy: (title: string) => `amb «${title}»`,
    notSold: 'No venut',
    notSoldLong: 'No registrat com a venut',
    noCardsInPlay: "No hi ha cartrons en joc registrats: no es pot avisar dels que no s'han venut.",
    inPlayError: 'Els cartrons en joc no es poden llegir.',
    /** The Desgraciat round: the songs until one card stands, and the count's curve. */
    untilLast: "Fins a l'últim dempeus",
    lastNow: 'Ja només en queda un',
    curve: 'Cartrons dempeus després de cada cançó',
    curveBar: (song: number, standing: number) => `${song === 1 ? 'Després de la següent cançó' : `D'aquí a ${song} cançons`}: ${standing} dempeus`,
    curveFirst: 'la següent',
    curveLast: (song: number) => `d'aquí a ${song}`,
    noWinnersHere: 'En aquesta quina no hi ha possibles guanyadors: la pestanya Dempeus diu qui queda.',
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
    /** The shared win: the cards that sat down with the last song (CheckOutcome 'fellLast'). */
    fellLast: (song: string | null) => (song ? `Han caigut amb l'última («${song}»)` : "Han caigut amb l'última cançó"),
    fellLastNote: "Si ningú de la sala queda dempeus, els que han caigut amb l'última es reparteixen el premi: comproveu cada cartró.",
    noCards: "No hi ha cartrons en joc registrats: no es pot comptar qui queda dempeus.",
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
    title: 'Pausa tècnica',
    since: (clock: string) => `des de fa ${clock}`,
    note: 'El projector i els mòbils mostren «Tornem de seguida». Sona la música d\'espera.',
    end: 'Acaba la pausa',
    start: 'Pausa tècnica',
  },

  check: {
    title: (cardId: number) => CA.checking(cardId),
    none: 'Cap comprovació en marxa',
    claims: 'Cartrons cantats',
    claimsOf: (kind: WinKind) => `Cartrons cantats · ${kindWord[kind]}`,
    claimedAt: (song: number) => `cantat a la cançó ${song}`,
    steps: (cardId: number, what: string) => `${CA.card(cardId)} · ${what} · cançó a cançó`,
    rowShort: (row: number) => `fila ${row + 1}`,
    allSongsShort: 'les 12 cançons',
    resultMissing: (titles: readonly string[], kind: WinKind) => `Resultat: falta ${listing(titles)}. Aquest cartró no té ${kindWord[kind]}.`,
    resultComplete: (kind: WinKind) =>
      kind === 'standing' ? "Resultat: no n'ha sonat cap. Aquest cartró és l'últim dempeus!" : `Resultat: han sonat totes. Aquest cartró té ${kindWord[kind]}!`,
    /** A standing claim for a card that fell (the Desgraciat round), naming the song that sank it. */
    resultFellLast: (title: string | null) =>
      `Resultat: ha caigut amb l'última cançó${title ? `, «${title}»` : ''}. Comparteix el premi si ningú més queda dempeus.`,
    resultFallen: (title: string | null) => (title ? `Resultat: «${title}» ja ha sonat. Aquest cartró ha caigut.` : "Resultat: una de les seves cançons ja ha sonat. Aquest cartró ha caigut."),
    decide: 'Decisió',
    confirmNote: 'ha passat la comprovació',
    rejectNote: 'sona la fanfàrria de fallada',
    kind: kindLabel,
    status: { queued: 'A la cua', checking: 'Comprovant…', checked: 'Falta decidir', valid: 'Vàlid', invalid: 'No vàlid' } satisfies Record<ClaimStatus, string>,
    outcome: {
      complete: 'Complet',
      incomplete: 'Incomplet',
      fallen: 'Ha caigut: una de les seves cançons ja ha sonat',
      fellLast: "Ha caigut amb l'última cançó: comparteix el premi si ningú més queda dempeus",
      unknownCard: 'Aquest número de cartró no existeix',
      wrongType: "Cartró d'un altre tipus: no val en aquesta quina",
    } satisfies Record<CheckOutcome, string>,
    completeSince: (n: number, kind: WinKind = 'line') => (kind === 'standing' ? `l'únic dempeus des de la cançó ${n}` : `complet des de la cançó ${n}`),
    notSold: 'No registrat com a venut',
    checkNow: 'Comprova',
    recheck: 'Tornar a comprovar',
    addClaim: 'Un altre cartró',
    waiting: 'Comença en un moment…',
    progress: (done: number, total: number) => `${done} de ${total} cançons`,
    otherRows: (rows: readonly number[]) =>
      rows.length > 1 ? `També té completes les files ${rows.map((r) => r + 1).join(', ')}` : `També té completa la fila ${rows.map((r) => r + 1).join(', ')}`,
    landed: CA.landed,
    /** A standing card that sat down with the song that just landed (the shared win): that step passes. */
    landedLast: "Ha sonat amb l'última",
    notLanded: CA.notLanded,
    pending: 'Pendent',
    playing: 'Sonant',
    confirm: 'Confirmar',
    reject: 'Rebutjar',
    againstResult: 'Va contra el resultat: mantén premut',
    decideAfterResult: 'Podreu decidir quan surti el resultat.',
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
    toInterval: 'Passa a la mitja part',
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
    next: (n: number, total: number, desgraciat = false) => (desgraciat ? CA.desgraciatRound : CA.roundOf(n, total)),
    guide: 'Compte enrere orientatiu',
    over: (clock: string) => `+${clock}`,
    start: 'Comença la quina',
    startNote: 'Primer anuncieu els premis.',
  },

  intervalMusic: {
    title: 'Música de la mitja part',
    track: (title: string, artist: string) => (artist ? `${title} · ${artist}` : title),
    position: (index: number, count: number) => `Cançó ${index} de ${count}`,
    waiting: 'Encara sona la música anterior; la llista entra tot seguit.',
    skip: 'Salta la cançó',
    skipNote: 'Canvia al següent compàs, amb una sortida suau.',
    volume: 'Volum',
    volumeValue: (db: number) => (db === 0 ? '0 dB (màxim)' : `${db} dB`),
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
    noRound: (n: number) => `El pla no té la ${CA.round(n)}.`,
    secret: 'Secrets: els mòbils encara no els veuen',
    reveal: 'Revelar premis',
    revealed: 'Revelats: els mòbils ja els veuen',
  },

  tabs: { label: 'Ajudes', standing: 'Dempeus', future: 'Futur', prizes: 'Premis', effects: 'Efectes' },

  cheatSheet: {
    prizes: (n: number, desgraciat = false) => `Premis de la ${desgraciat ? CA.desgraciatRound : CA.round(n)}`,
    specialRules: CA.specialRound,
    claimRules: 'Normes per cantar',
    keys: 'Tecles del portàtil (pla B)',
    checklist: 'Preparació',
  },

  /** The laptop's Plan B keys, from the mixer README's "Show keys". */
  showKeys: [
    { keys: '→ / Retorn', action: 'Següent (també allibera el suspens)' },
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

  numpad: {
    title: 'Comprovar cartró',
    display: 'Número de cartró',
    empty: '—',
    back: 'Esborra',
    clear: 'Esborra-ho tot',
    clearKey: 'C',
    kind: 'Què canta?',
    kinds: kindLabel,
    submit: (n: number | null) => (n === null ? 'Comprova el cartró' : `Comprova el cartró ${n}`),
    notSold: 'No registrat com a venut (només és un avís)',
    close: 'Tanca',
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
    batteryLow: 'Queda poca bateria: canvieu les piles a la mitja part.',
  },

  menu: {
    title: 'Menú',
    /** Under the title: this device and the round ("Tauleta · Quina 3 de 8"). */
    subtitle: (label: string | null, round: number | null, total: number) =>
      [label, round !== null && round >= 1 ? CA.roundOf(round, total) : null].filter(Boolean).join(' · '),
    close: 'Tanca',
    device: 'Aquest dispositiu',
    labelField: 'Nom del dispositiu',
    labelSave: 'Desa',
    labelNote: 'Les ordres porten el nom nou quan es torna a carregar la pàgina. El nom diu qui ha premut cada botó.',
    theme: 'Tema',
    themes: { light: 'Clar', dark: 'Fosc' } satisfies Record<Theme, string>,
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
    pause: 'Pausa tècnica',
    pauseNote: 'Projector i mòbils: «Tornem de seguida»',
    finalLap: "«Última volta» automàtica",
    finalLapNote: "La fanfàrria sona sola un cop per quina, quan arriba l'última volta. Des d'Efectes es pot tocar igualment.",
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
    notNow: "Només es pot recuperar abans de començar, a la mitja part o al final, i amb el portàtil connectat.",
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
    failedCheck: 'un cartró que no ha passat la comprovació no es pot donar per bo',
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
    decide: 'Decisió',
    winnerInfo: 'Dades del guanyador',
    celebrationMusic: 'Música de la celebració',
    interval: 'Mitja part',
    endGame: 'Acabar la nit',
    pause: 'Pausa tècnica',
    intervalSkip: 'Saltar cançó',
    resumeAt: 'Recuperar el show',
    revealPrizes: 'Revelar premis',
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
