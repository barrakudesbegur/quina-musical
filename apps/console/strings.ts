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
import type { ConsoleCommand, Theme } from './config.ts';

export { CA };

const seconds = (s: number) => `${s} s`;
const kindLabel: Record<WinKind, string> = { line: CA.line, bingo: CA.bingo };
/** "línia" or "quina", inside a sentence. */
const kindWord: Record<WinKind, string> = { line: 'línia', bingo: 'quina' };
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
    round: (n: number, special: boolean) => (special ? `${CA.round(n)} · especial` : CA.round(n)),
    stale: 'Dades antigues',
  },

  phase: { early: 'Inici', mid: 'Mig', late: 'Tardana', final: 'Final' } satisfies Record<PhaseName, string>,
  climbing: { line: 'cap a la línia', bingo: 'cap a la quina' } satisfies Record<WinKind, string>,

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
    talkNote: 'la música baixa i no gira',
    stay: 'Aguanta',
    stayNote: 'la cançó segueix; no gira',
    /** A pressed Parlem or Aguanta: pressing it again releases the Hold. */
    activeNote: 'prem per reprendre',
    suspense: 'Suspens',
    suspenseIdle: 'mantén per crear tensió',
    suspenseOpen: 'deixa anar per aterrar',
    suspenseAutoRelease: "s'allibera sol en",
    back: 'Enrere',
    backHint: "Mantén premut per desfer l'última cançó",
    claim: 'Comprovar cartró',
  },

  longPress: { hint: 'Mantén premut per confirmar', percent: (p: number) => `${p} %` },

  nowPlaying: {
    title: CA.nowPlaying,
    nothing: 'No sona cap cançó',
    holdMusic: "Música d'espera",
    autoIn: 'Següent automàtic',
    autoOff: 'Avanç automàtic aturat',
    autoOffFinal: 'Fase final: sense avanç automàtic',
    autoHeld: 'En espera: sense avanç automàtic',
    spinning: 'Girant…',
    idle: 'Esperant «Següent»',
    autoBadge: 'Avança sol',
    seconds,
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
    recommended: 'recomanat',
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
    resultComplete: (kind: WinKind) => `Resultat: han sonat totes. Aquest cartró té ${kindWord[kind]}!`,
    decide: 'Decisió',
    confirmNote: 'el presentador sempre decideix',
    rejectNote: 'sona la fanfàrria de fallada',
    kind: kindLabel,
    status: { queued: 'A la cua', checking: 'Comprovant…', checked: 'Falta decidir', valid: 'Vàlid', invalid: 'No vàlid' } satisfies Record<ClaimStatus, string>,
    outcome: {
      complete: 'Complet',
      incomplete: 'Incomplet',
      unknownCard: 'Aquest número de cartró no existeix',
      wrongType: "Cartró d'un altre tipus: no val en aquesta quina",
    } satisfies Record<CheckOutcome, string>,
    completeSince: (n: number) => `complet des de la cançó ${n}`,
    notSold: 'No registrat com a venut',
    checkNow: 'Comprova',
    recheck: 'Tornar a comprovar',
    addClaim: 'Un altre cartró',
    waiting: 'Comença en un moment…',
    progress: (done: number, total: number) => `${done} de ${total} cançons`,
    otherRows: (rows: readonly number[]) =>
      rows.length > 1 ? `També té completes les files ${rows.map((r) => r + 1).join(', ')}` : `També té completa la fila ${rows.map((r) => r + 1).join(', ')}`,
    landed: CA.landed,
    notLanded: CA.notLanded,
    pending: 'Pendent',
    playing: 'Sonant',
    confirm: 'Confirmar',
    reject: 'Rebutjar',
    againstResult: 'Va contra el resultat: mantén premut',
    decideAfterResult: 'Podreu decidir quan surti el resultat.',
  },

  celebration: {
    title: CA.shout,
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
    notes: 'Notes',
    save: 'Desa',
    saved: 'Desat',
    privacy: 'Privat: només a la consola i a les dades del núvol.',
    edit: 'Edita',
    close: 'Tanca',
  },

  winnersList: {
    title: CA.winners,
    empty: 'Encara no hi ha guanyadors.',
    item: (kind: WinKind, cardId: number) => `${kindLabel[kind]} · ${CA.card(cardId)}`,
    noName: 'Sense nom',
  },

  interval: {
    title: CA.scene.interval,
    next: (n: number, total: number) => CA.roundOf(n, total),
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
    sponsoredBy: CA.sponsoredBy,
    none: 'Sense premi',
    special: CA.specialRound,
    noPlan: "Encara no hi ha pla de la nit: deseu-lo des de l'Admin.",
    noRound: (n: number) => `El pla no té la ${CA.round(n)}.`,
  },

  tabs: { label: 'Ajudes', future: 'Futur', prizes: 'Premis', effects: 'Efectes' },

  cheatSheet: {
    prizes: (n: number) => `Premis de la ${CA.round(n)}`,
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

  menu: {
    title: 'Menú',
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
    end: 'Acabar la nit',
    endNote: 'Mantén premut',
    schedule: 'Horari',
    roundsTotal: 'Quines en total',
    roundsMinus: 'Una quina menys',
    roundsPlus: 'Una quina més',
    gameEnd: (clock: string, drift: string) => `Final previst de la nit: ${clock} (${drift})`,
    pause: 'Pausa tècnica',
    pace: 'Ritme',
    phase: 'Fase',
    phaseAuto: 'Automàtica',
    winners: CA.winners,
    planB: 'Xuleta del pla B',
    tools: 'Eines',
    confirmLine: 'Confirma la línia sense comprovació',
    confirmLineNote: 'Només si no s\'ha pogut fer la comprovació.',
    panic: 'Pànic',
    panicNote: 'Mantén premut: silencia-ho tot al moment.',
    wii: 'Comandament Wii',
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
