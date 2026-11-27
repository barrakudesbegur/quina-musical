// Admin's on-screen words, in Catalan. Shared terms ("Quina 3", "Línia", "Premi de quina", the scene names)
// come from ui/i18n/ca.ts; everything Admin-specific lives here, never inline in markup.
import type { ShowStatus, WinKind } from '@quina/protocol';
import { CA } from '../../packages/ui/i18n/ca.ts';
import { roundTitle, roundTitleOf, type CheatSheet, type PrizeReveal } from '../../packages/ui/plan.ts';
import type { CheatSheetCopy } from './logic/cheatsheet.ts';
import type { Route } from './logic/route.ts';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/** "1, 2 i 3". */
const joinCa = (items: readonly (string | number)[]): string =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} i ${items[items.length - 1]}`;

export const S = {
  pageTitle: 'Admin · Quina Musical',
  heading: 'Admin',
  /** A round's name: "Quina 4" by its Quina number, "Quina Especial", "Quina del Desgraciat" (plan.ts roundTitle). */
  round: roundTitle,
  /** With the night's total: "Quina 4 de 8" (what the total counts is pending U163); a special round has none. */
  roundOf: roundTitleOf,

  nav: {
    label: 'Seccions',
    preparacio: 'Preparació',
    json: 'Importar i exportar',
    nit: 'La nit',
    eines: 'Eines',
    xuleta: 'Xuleta',
  } satisfies Record<Route | 'label', string>,

  conn: {
    connecting: 'Connectant amb el relay…',
    offline: 'Sense connexió amb el relay',
    noShow: 'Connectat, però la pantalla del show no està oberta',
    online: 'Connectat al show',
    demo: (name: string) => `Demo «${name}»: les ordres no fan res`,
  },

  save: {
    saved: (time: string) => `Desat a les ${time}`,
    /** A plan loaded from where it's kept, not changed since. */
    loaded: (where: 'cloud' | 'relay' | 'local' | 'demo' | 'unavailable') =>
      where === 'cloud' ? 'Desat al núvol' : where === 'relay' ? 'Desat al portàtil del show' : 'Desat en aquest navegador',
    pending: 'Canvis per desar…',
    invalid: (n: number) => `${plural(n, 'error', 'errors')}: no es desa fins que es corregeixin`,
    quota: "No s'ha pogut desar: l'emmagatzematge del navegador és ple (segurament pels logos). Treu o redueix algun logo, i exporta el JSON com a còpia.",
    unavailable: 'Aquest navegador no deixa desar (mode privat?). Exporta el JSON abans de tancar.',
    error: (detail: string) => `No s'ha pogut desar: ${detail}`,
    demo: 'Mode demo: els canvis no es desen',
    conflict: 'El pla ha canviat en una altra pestanya mentre editaves aquí.',
    conflictLoad: 'Carregar el pla de l’altra pestanya',
    conflictKeep: 'Mantenir el meu',
  },

  plan: {
    title: 'La nit',
    name: "Nom de l'edició",
    nameHelp: 'Surt a totes les pantalles: per exemple, «Quina Quina 3».',
    edition: 'Edició (any, dues xifres)',
    editionHelp: 'Va als QR dels cartrons (/26/123) i separa les dades de cada any.',
    prizeReveal: 'Premis',
    prizeRevealOptions: {
      perRound: 'Es revelen a cada quina',
      allSecret: 'Tots secrets',
    } satisfies Record<PrizeReveal, string>,
    prizeRevealHelp: {
      perRound: 'Els mòbils veuen els premis de la Quina 1 des del principi, i els de cada quina quan es presenta. La consola també els pot revelar abans.',
      allSecret: 'Els mòbils no veuen cap premi fins que els presentadors els revelen des de la consola, quina a quina.',
    } satisfies Record<PrizeReveal, string>,
    cardTypes: 'Tipus de cartró',
    cardTypesHelp: 'Venen dels cartrons impresos (apps/cards, card-types.json): nom, color i preu es canvien allà. Cada quina tria quin tipus hi juga, a «Quines».',
    cardTypesMissing: "No s'han pogut llegir els tipus dels cartrons impresos (card-types.json): es mostren els que ja té el pla, si en té.",
    cardPriceLabel: (cents: number | null) => (cents === null ? 'Sense preu' : `${(cents / 100).toLocaleString('ca-ES', { minimumFractionDigits: cents % 100 ? 2 : 0 })} €`),
    cardName: 'Nom',
    cardColor: 'Color',
    cardPrice: 'Preu (€)',
    cardPriceHelp: 'Buit: sense preu.',
    /** Where a type plays tonight: its regular rounds by Quina number (roundsByCardType), and the special rounds. */
    cardRounds: (regular: readonly number[], special: boolean, desgraciat = false) => {
      const parts = [
        ...(regular.length ? [regular.length === 1 ? `la ${CA.round(regular[0])}` : `les quines ${joinCa(regular)}`] : []),
        ...(special ? ['la quina especial'] : []),
        ...(desgraciat ? ['la quina del Desgraciat'] : []),
      ];
      return parts.length ? `Juga a ${joinCa(parts)}` : 'No juga a cap quina';
    },
  },

  errors: {
    title: (n: number) => plural(n, 'cosa per corregir', 'coses per corregir'),
    help: 'Cada error porta el seu camí dins del JSON: plan.rounds[2].line[0].title és el primer premi de línia de la Quina 3.',
  },

  cards: {
    title: 'Cartrons en joc',
    help: 'Els cartrons venuts, per rangs: «1-180, 200-215, 400-460». Cada quina només compta els del tipus que hi juga.',
    label: 'Rangs de cartrons',
    count: (n: number) => plural(n, 'cartró', 'cartrons'),
    /** How many cards of a printed type ("Cartró normal: 180"). */
    ofType: (name: string, n: number) => `${name}: ${n}`,
    unknown: (n: number, ranges: string) => `${plural(n, 'número no és', 'números no són')} cap cartró generat: ${ranges}`,
    typesUnknown: "No s'han pogut carregar els cartrons generats: no se sap de quin tipus és cada un.",
    willSend: "S'enviarà",
    empty: "Buit: s'esborraran els cartrons en joc.",
    send: 'Enviar al show',
    engine: 'El show té',
    engineNone: 'cap cartró en joc',
    engineCounts: (inPlay: number, valid: number) => `${plural(inPlay, 'cartró', 'cartrons')} en joc, ${valid} valen per a la quina actual`,
    matches: 'Coincideix amb el que té el show.',
    differs: 'És diferent del que té el show.',
    error: {
      token: (t: string) => `«${t}» no és un número ni un rang`,
      tooLarge: (t: string) => `El rang «${t}» és massa gran`,
      tooLong: (n: number, max: number) => `Massa llarg: ${n} caràcters (màxim ${max})`,
    },
  },

  rounds: {
    title: 'Quines',
    help: "Cada quina, normal, especial o del Desgraciat, amb el tipus de cartró i la cara que hi juguen, i els seus premis: de línia i de quina, o a la del Desgraciat només el de l'últim dempeus. Es numeren soles quan les mous.",
    liveHelp: 'Durant la nit, les quines jugades i la que està en joc queden fixades. Les següents es poden moure i editar en directe: el show, la pantalla i els mòbils ho veuen en desar.',
    played: 'Jugada',
    inPlay: 'En joc',
    /** With the round's name (S.round), as the labels below. */
    fixedLabel: (name: string) => `La ${name} ja ha començat: no es pot moure ni treure`,
    kind: 'Tipus',
    normal: 'Normal',
    special: 'Especial',
    desgraciat: 'Desgraciat',
    /** The option's name when another round already is the Desgraciat one (it is disabled). It has no number to name
     * it by (S.round), and its row says "Quina del Desgraciat". */
    desgraciatTaken: "Desgraciat (ja n'hi ha una)",
    oneDesgraciat: "Només hi pot haver una Quina del Desgraciat per nit. Canvia'n una a normal.",
    desgraciatHelp: "Tothom dempeus: un cartró s'asseu quan sona qualsevol de les seves cançons, i guanya l'últim que queda dempeus. No té línia.",
    linesMoved: (n: number) =>
      n === 1 ? "La Quina del Desgraciat no té línia: el seu premi de línia ara és un premi de l'últim dempeus." : `La Quina del Desgraciat no té línia: els seus ${n} premis de línia ara són premis de l'últim dempeus.`,
    lineInDesgraciat: "La Quina del Desgraciat no té línia: aquests premis no es lliurarien. Passa'ls al premi de l'últim dempeus o treu-los.",
    moveLine: "Passar-los al premi de l'últim dempeus",
    cardType: 'Cartrons que hi juguen',
    side: 'Cara',
    /** A side in the picker, with its label from card-types.json: the Quines it's printed for when it's a range (D171,
     * "1–5"), else the round's name (D226, "Quina Especial"). */
    sideOption: (side: number, label: string | null) => (label ? `Cara ${side} · ${/^\d/.test(label) ? `Quines ${label}` : label}` : `Cara ${side}`),
    /** The plan's side problems against the printed cards (sideWarnings): they don't stop saving. */
    sideWarnings: 'Cares dels cartrons',
    unknownCardType: (id: string) =>
      `El tipus «${id}» no és a card-types.json dels cartrons impresos: cap cartró no comptaria en aquesta quina. Tria'n un de la llista, o genera abans els cartrons d'aquest tipus.`,
    up: 'Pujar',
    down: 'Baixar',
    upLabel: (name: string) => `Pujar la ${name}`,
    downLabel: (name: string) => `Baixar la ${name}`,
    remove: 'Treure',
    removeLabel: (name: string) => `Treure la ${name}`,
    confirmRemove: 'Segur? Treure',
    add: 'Afegir una quina',
    engineTotal: (engine: number, plan: number) => `El show compta ${engine} quines i el pla en té ${plan}.`,
    syncTotal: 'Enviar el nombre de quines al show',
  },

  prize: {
    offer: (text: string) => `Segons el full, regala: «${text}»`,
    useOffer: 'Usar-ho com a títol',
    empty: 'Encara no hi ha cap premi: les pantalles diran que està per anunciar.',
    add: 'Afegir un premi',
    headline: 'Destacat (surt primer i més gran)',
    upLabel: (n: number) => `Pujar el premi ${n}`,
    downLabel: (n: number) => `Baixar el premi ${n}`,
    remove: 'Treure',
    removeLabel: (n: number) => `Treure el premi ${n}`,
    confirmRemove: 'Segur? Treure',
    title: 'Premi',
    detail: 'Detall (opcional)',
    sponsor: 'Patrocinador',
    noSponsor: 'Cap',
    image: 'Imatge del premi (ruta, opcional)',
  },

  sponsors: {
    title: 'Patrocinadors',
    help: "Qui dona cada premi. L'identificador és el que fan servir els premis i el JSON; si el canvies, els premis el segueixen.",
    name: 'Nom',
    id: 'Identificador',
    newName: 'Nou patrocinador',
    add: 'Afegir un patrocinador',
    remove: 'Treure',
    removeLabel: (name: string) => `Treure ${name}`,
    confirmRemove: (prizes: number) => (prizes ? `Segur? ${plural(prizes, 'premi es queda', 'premis es queden')} sense patrocinador` : 'Segur? Treure'),
    usage: (n: number) => (n ? `Dona ${plural(n, 'premi', 'premis')}` : 'Encara no dona cap premi'),
    logo: 'Logo',
    noLogo: 'Sense logo',
    editLogo: 'Afegir o netejar el logo',
    removeLogo: 'Treure el logo',
    logoAlt: (name: string) => `Logo de ${name}`,
  },

  library: {
    open: 'Triar de la biblioteca',
    title: (name: string) => `Biblioteca de logos per a ${name}`,
    search: 'Cercar',
    close: 'Tancar',
    loading: 'Carregant la biblioteca…',
    failed: "No s'ha pogut carregar la biblioteca de logos del núvol.",
    empty: 'Encara no hi ha cap logo pujat.',
    noMatch: 'Cap logo coincideix amb la cerca.',
    pick: (name: string) => `Fer servir ${name}`,
  },

  bulk: {
    title: 'Pujar logos a la biblioteca',
    help: "Tria els logos nets d'una carpeta (els PNG i, si n'hi ha, els JXL amb el mateix nom). Cada un es puja amb el seu nom, i després el trobes a «Triar de la biblioteca». Els que ja hi són no es tornen a pujar.",
    files: 'Fitxers',
    skipped: (names: readonly string[]) => `No es pugen: ${names.join(', ')}`,
    upload: (n: number) => (n === 1 ? 'Pujar 1 logo' : `Pujar ${n} logos`),
    progress: (done: number, total: number) => `${done} de ${total} pujats`,
    state: { waiting: 'per pujar', uploading: 'pujant…', done: 'pujat', exists: 'ja hi era', failed: 'error' },
  },

  sponsorImport: {
    title: 'Importar patrocinadors del full',
    help: "Exporta el full de col·laboradors com a CSV i puja'l aquí. Només es llegeixen el nom, la categoria, si participa, què regala i si hi ha logo; la resta del full (qui ho té, entregues, tasques) no es llegeix mai. Els que participen surten marcats.",
    file: 'Fitxer CSV',
    noHeader: "No trobo la fila de capçalera (COMERÇ, PARTICIPA…). És el CSV del full de col·laboradors?",
    add: 'Afegir',
    name: 'Comerç',
    offer: 'Què regala',
    logo: 'Logo',
    hasLogo: 'Sí',
    known: 'ja hi és',
    waiting: 'esperant',
    unknown: 'sense resposta',
    pick: (name: string) => `Afegir ${name}`,
    addCount: (n: number) => (n === 1 ? 'Afegir 1 patrocinador' : `Afegir ${n} patrocinadors`),
    added: (n: number) => (n === 1 ? "S'ha afegit 1 patrocinador. Recorda desar." : `S'han afegit ${n} patrocinadors. Recorda desar.`),
    /** Throws the loaded list away (D164, D188: a button says what happens). */
    cancel: 'Descarta els canvis',
  },

  logo: {
    title: (name: string) => `Logo de ${name}`,
    help: 'Puja el JPEG o PNG del patrocinador: es treu el fons, es retalla el marge i es redueix a 512×256 com a màxim.',
    file: "Fitxer d'imatge",
    removeBackground: 'Treure el fons',
    mode: 'Quin fons es treu',
    modeEdges: 'Només el que toca les vores (conserva el blanc de dins del logo)',
    modeAll: 'Tot aquest color (també els forats de dins, com el d’una «O»)',
    tolerance: 'Tolerància',
    softness: 'Vora suau',
    detected: (hex: string, corners: number) => `Fons detectat: ${hex} (${corners} de 4 cantonades)`,
    transparent: 'La imatge ja té el fons transparent: només es retalla.',
    unclear: 'Les cantonades no coincideixen i no es veu clar quin és el fons: només es retalla.',
    empty: 'No queda res del logo: baixa la tolerància.',
    original: 'Original',
    onCheckerboard: 'Sobre transparent',
    onShow: 'Sobre el fons del show',
    size: (w: number, h: number, kb: number, format: string) => `${w}×${h} px · ${kb} KB · ${format}`,
    tooBig: (kb: number, max: number) => `Fa ${kb} KB, més de ${max} KB: no es pot desar. Retalla-la o simplifica-la abans.`,
    use: 'Fer servir aquest logo',
    close: 'Tancar',
    working: 'Processant…',
    readError: "No s'ha pogut llegir la imatge. Prova amb un JPEG o un PNG.",
    storageNote: "De moment el logo es guarda dins del pla, en aquest navegador. Quan hi hagi núvol anirà a l'emmagatzematge de fitxers.",
  },

  schedule: {
    title: 'Horari',
    /** The doors open and the cards go on sale (D150, D152): the phones' Horari starts with it. */
    doors: 'Venda de cartrons',
    clearDoors: "Treure l'hora",
    doorsAfterStart: 'La venda de cartrons ha de començar abans de la primera quina.',
    start: 'Inici de la primera quina',
    clearStart: "Treure l'hora",
    roundMinutes: 'Durada de cada quina (minuts)',
    intervalMinutes: 'Durada de cada descans (minuts)',
    plannedEnd: (time: string) => `Final previst: ${time}`,
    noStart: "Sense hora d'inici, no hi ha final previst.",
    /** The planned Throws (D136, D192): the break after that round lasts its minutes, the throw inside it. */
    throws: 'Llançaments',
    throwsHelp: "El descans de després d'aquella quina dura els minuts que hi posis, amb el llançament a dins (en lloc del descans normal).",
    noThrows: 'Cap llançament planificat entre quines.',
    /** With the round's name (S.round). */
    throwAfter: (name: string) => `Descans amb llançament, després de la ${name}`,
    throwMinutes: (name: string) => `Minuts del descans amb llançament després de la ${name}`,
    addThrowAfter: 'Afegir un llançament després de',
    addThrow: 'Afegir llançament',
    removeThrow: 'Treure',
  },

  rules: {
    title: 'Normes de la xuleta',
    claim: 'Normes per cantar',
    special: 'Normes de la quina especial',
    item: (n: number) => `Norma ${n}`,
    add: 'Afegir una norma',
    remove: 'Treure',
    removeLabel: (n: number) => `Treure la norma ${n}`,
  },

  json: {
    importTitle: 'Importar un pla',
    importHelp: "Enganxa el JSON o tria un fitxer. El format és a apps/admin/README.md, perquè un agent d'IA el pugui fer a partir del full de càlcul.",
    paste: 'JSON del pla',
    file: 'O tria un fitxer .json',
    check: 'Comprovar',
    empty: 'No hi ha res a importar.',
    syntax: (message: string) => `No és JSON vàlid: ${message}`,
    invalid: (n: number) => `El JSON té ${plural(n, 'error', 'errors')}. Corregeix-los tots i torna-ho a provar:`,
    ok: 'El JSON és correcte. Això és el que canviaria:',
    same: 'És igual que el pla actual: no hi ha res a canviar.',
    rounds: (before: number, after: number) => `Quines: ${before} → ${after}`,
    roundsAdded: (list: string) => `afegides: ${list}`,
    roundsRemoved: (list: string) => `tretes: ${list}`,
    roundsKind: (list: string) => `canvien de tipus: ${list}`,
    roundsCardType: (list: string) => `canvien de cartrons: ${list}`,
    roundsSide: (list: string) => `canvien de cara: ${list}`,
    prizes: (n: number) => plural(n, 'premi canvia', 'premis canvien'),
    prizeLine: (round: string, label: string, before: string | null, after: string | null) => `${round}, ${label.toLowerCase()}: ${before ?? '(cap)'} → ${after ?? '(cap)'}`,
    sponsorsAdded: (list: string) => `Patrocinadors nous: ${list}`,
    sponsorsRemoved: (list: string) => `Patrocinadors que es treuen: ${list}`,
    sponsorsChanged: (list: string) => `Patrocinadors que canvien (nom o logo): ${list}`,
    schedule: "L'horari canvia",
    cheatSheet: 'Les normes de la xuleta canvien',
    prizeReveal: 'Canvia quan es revelen els premis',
    title: 'El nom canvia',
    edition: "L'edició canvia",
    order: "Només canvia l'ordre dels patrocinadors",
    replace: 'Substituir',
    discard: 'Descartar',
    replaced: 'Pla substituït.',
    fileError: "No s'ha pogut llegir el fitxer.",
    exportTitle: 'Exportar el pla',
    exportHelp: 'El pla vàlid actual, amb els logos a dins. És el mateix format que la importació.',
    exportStale: "El pla que edites té errors: s'exporta l'últim pla vàlid.",
    noPlan: 'Encara no hi ha cap pla vàlid per exportar.',
    download: 'Descarregar el JSON',
    copy: 'Copiar',
    copied: 'Copiat al porta-retalls.',
    copyFailed: "No s'ha pogut copiar: selecciona el text de sota i copia'l a mà.",
    preview: 'JSON del pla',
  },

  night: {
    statusTitle: 'Estat del show',
    scene: 'Escena',
    status: 'Àudio',
    round: 'Quina actual',
    noState: 'Encara no hi ha dades del show.',
    statusNames: {
      locked: 'Bloquejat (falta el clic inicial)',
      idle: 'Aturat',
      playing: 'Sonant',
      transition: 'Canviant de cançó',
      hold: 'En espera',
    } satisfies Record<ShowStatus, string>,
    gameTitle: 'Començar i acabar',
    start: 'Començar la Quina Musical',
    startHelp: 'Presenta la primera quina al projector, amb els premis. La barreja es fa des de la consola.',
    startOnlyBefore: 'Només es pot fer abans de començar.',
    end: 'Acabar la Quina Musical',
    endHelp: 'Passa a la pantalla final, amb els agraïments. Si ha estat un error, es desfà presentant la quina següent.',
    endWord: 'ACABAR',
    endConfirm: (word: string) => `Escriu ${word} per confirmar`,
    resumeTitle: 'Recuperar el show (pla B)',
    resumeHelp: "Si el portàtil s'ha reiniciat o se n'ha posat un altre, continua la quina on era amb el codi de recuperació. La tauleta el guarda sola, i també es pot apuntar en paper.",
    resumeField: 'Codi de recuperació',
    resumePlaceholder: 'Q3N-4K7XM2P-17-S41',
    resumeInvalid: 'Aquest codi no és vàlid. Ha de ser com Q3N-4K7XM2P-17-S41.',
    resumePreview: (round: string, counted: number, title: string | null) =>
      counted === 0
        ? `${round}: encara no ha comptat cap cançó.`
        : `${round}: ${counted} cançons comptades. L'última: ${title ?? 'cançó desconeguda'}.`,
    resumeLineFrom: (song: number) => `Línia confirmada (la quina comptava des de la cançó ${song}).`,
    resume: 'Recuperar al portàtil',
    resumeConfirm: 'Sí, recuperar-lo',
    /** Closes the question; nothing is recovered (D164, D188). */
    resumeCancel: 'Tanca',
    resumeAsk: 'El portàtil reconstruirà la quina i es quedarà en espera. Segur?',
    resumeNotNow: 'Només es pot fer abans de començar, en un descans o al final.',
    cloudTitle: 'Partides al núvol',
    cloudHelp: "El núvol guarda cada partida. Si el portàtil s'ha canviat amb internet, tria la partida i el portàtil la recupera sencera quan es connecta.",
    cloudLoading: 'Carregant les partides…',
    cloudError: "No s'han pogut carregar les partides del núvol.",
    cloudNone: 'Encara no hi ha cap partida al núvol.',
    cloudGame: (rounds: number, last: string) => `${rounds} quines · última activitat ${last}`,
    cloudCurrent: 'Actual',
    cloudUse: 'Fes-la servir al portàtil',
    cloudDone: 'Fet: el portàtil la recupera ara.',
    cloudWaiting: "Fet: el portàtil la recuperarà quan es torni a connectar.",
    cloudFailed: (status: number) => `No s'ha pogut (error ${status}).`,
    seedReveal: 'Mostra el codi de recuperació',
    seedHide: 'Amaga el codi',
    seedNote: 'El codi conté la llavor de la barreja: amb ella i els cartrons es pot saber tot l\'ordre. No el mostreu mai a la pantalla gran.',
    winnersTitle: 'Guanyadors',
    privacy: 'Els noms són privats: mai surten al projector, als mòbils ni a git. Només es guarden a les dades de la partida.',
    noWinners: 'Encara no hi ha guanyadors.',
    col: { round: 'Quina', kind: 'Premi', card: 'Cartró', song: 'Cançó guanyadora', prize: 'Què guanya', name: 'Nom', notes: 'Notes', action: 'Desar' },
    /** What a Winner won: "Línia", "Quina", or the Desgraciat round's "Últim cartró dempeus" (D186). */
    kind: { line: CA.line, bingo: CA.bingo, standing: 'Últim cartró dempeus' } satisfies Record<WinKind, string>,
    nameLabel: (card: string) => `Nom del guanyador del ${card.toLowerCase()}`,
    notesLabel: (card: string) => `Notes del ${card.toLowerCase()}`,
    saveWinner: 'Desar',
    winnerSynced: 'Desat',
    winnerDirty: 'Sense desar',
    phonesTitle: 'Cartrons oberts als mòbils',
    phonesPending: 'Pendent del núvol: quan la plataforma tingui el canal dels mòbils, aquí sortiran els números de cartró oberts (anònims, sense cap nom).',
    playerTitle: 'Aplicació dels jugadors',
    playerHelp: "Arriba a tots els mòbils quan l'envies, també als que es connectin després.",
    /** Admin served by the laptop: the cloud's settings can't be reached from here (D227). */
    playerNotCloud: "Només s'envia als mòbils des de l'Admin del núvol. Aquí només es desa en aquest dispositiu.",
    sounds: 'Sons de la interfície activats per defecte',
    soundsHelp: 'Cada jugador ho pot canviar al seu mòbil, i la seva tria guanya.',
    banner: 'Missatge per a tots els mòbils',
    bannerHelp: (max: number) => `Màxim ${max} caràcters.`,
    bannerOn: 'Mostrar el missatge als mòbils',
    bannerOnHelp: "Apagat, els mòbils no en mostren cap. El text es queda aquí per a una altra vegada.",
    send: 'Enviar als mòbils',
    sending: 'Enviant als mòbils…',
    sent: 'Enviat a tots els mòbils.',
    sendFailed: (status: number) =>
      status === 0 ? "No s'ha pogut enviar: no hi ha connexió amb el núvol. Torna-ho a provar." : `No s'ha pogut enviar (error ${status}). Torna-ho a provar.`,
    saveLocal: 'Desar en aquest dispositiu',
    savedLocal: 'Desat en aquest dispositiu.',
    saveLocalFailed: "No s'ha pogut desar en aquest dispositiu.",
  },

  tools: {
    auditionTitle: 'Audició dels ganxos',
    auditionHelp: 'La pàgina per escoltar i ajustar on aterra cada cançó.',
    auditionLink: "Obrir l'audició",
    fullExportTitle: 'Exportació completa',
    fullExportHelp: 'El pla, els cartrons en joc i els guanyadors, tal com els té el show ara.',
    fullExportWarning: 'Conté els noms dels guanyadors, que són privats: guarda-ho on toqui i mai a git.',
    fullExportNoShow: 'Sense connexió amb el show: només hi haurà el pla.',
    download: 'Descarregar',
    seedsTitle: 'Llavors de la barreja',
    seedsPending: "Pendent: el diari de la partida les guarda, però l'Admin encara no el pot llegir.",
  },

  cheat: {
    title: 'Xuleta',
    print: 'Imprimir',
    printHelp: 'En fulls A4, en blanc i negre i lletra gran: una quina mai queda partida entre dos fulls.',
    noPlan: 'No hi ha cap pla vàlid: només surt la part fixa.',
    prizes: 'Premis',
    otherSponsors: 'Altres patrocinadors: agraïu-los també',
    noPrize: 'Sense premi',
    claimRules: 'Normes per cantar',
    specialRules: 'Quina especial',
    keys: 'Tecles del portàtil (pla B)',
    wii: 'Comandament de la Wii',
    checklist: 'Abans de començar',
  },

  command: {
    offline: 'No enviat: sense connexió amb el relay.',
    noShow: 'No enviat: la pantalla del show no està oberta.',
    sent: 'Enviat al show.',
    rejected: (reason: string) => `El show ho ha rebutjat: ${reason}.`,
    reasons: {
      invalid: "l'ordre no és vàlida",
      locked: 'el show encara no ha rebut el clic inicial',
      busy: 'està ocupat, torna-ho a provar',
      notReady: 'encara no està a punt',
      unknownCommand: 'el motor encara no coneix aquesta ordre',
      wrongScene: 'no es pot fer en aquest moment del show',
      unknownClaim: 'aquest cartró cantat no existeix',
      cannotResume: 'no es pot recuperar amb aquest codi: revisa la quina, la llavor i la cançó',
    } as Readonly<Record<string, string>>,
  },

  common: {
    demoNoSave: 'Mode demo',
    pendingCloud: 'Pendent del núvol',
    notAvailable: 'No disponible',
  },
} as const;

/** The cheat-sheet rules a new plan starts with (the organizers edit them). */
export const DEFAULT_RULES: CheatSheet = {
  claimRules: [
    'Guanya el primer que canta. Si dos canten amb la mateixa cançó, es reparteixen el premi.',
    'Si algú canta tard i ningú més ha cantat, guanya igualment.',
    'Un premi que ningú canta es perd.',
  ],
  specialRoundRules: ['Només compten els cartrons especials.'],
};

/**
 * The fixed parts of the cheat sheet. The keys are the show page's (README "Show keys"); keep them in sync
 * when the engine's keys change.
 */
export const CHEAT_SHEET_COPY: CheatSheetCopy = {
  keys: [
    { keys: '→ / Retorn', action: 'Següent (també deixa anar el Suspens)' },
    { keys: '←', action: "Enrere: desfà l'última cançó" },
    { keys: 'Espai', action: 'Espera / continuar' },
    { keys: 'S', action: 'Suspens' },
    { keys: 'M', action: "Música d'espera" },
    { keys: 'Esc', action: 'Pànic: silenci total' },
    { keys: '+ / −', action: 'Ritme ±1 s' },
    { keys: 'L', action: 'Bloquejar el ritme' },
    { keys: 'A', action: 'Avanç automàtic sí / no' },
    { keys: '0–4', action: 'Fase: automàtica, inicial, mitjana, avançada, final' },
    { keys: 'D', action: 'Panell de depuració' },
    { keys: 'H', action: 'Amagar els controls (projector)' },
    { keys: '[ / ]', action: 'Desfasament de la pantalla ±5 ms' },
  ],
  wiiReminder: 'El comandament de la Wii es vincula al portàtil, no a la tauleta. És opcional: la consola fa tot el que fa.',
  checklist: [
    "Apagada automàtica del punt d'accés (hotspot) desactivada",
    "Mòbil del punt d'accés connectat al carregador",
    "Segon mòbil, d'una altra companyia, a punt com a punt d'accés de reserva",
    'Bloqueig automàtic de la tauleta: mai',
    "Portàtil i tauleta provats al punt d'accés de debò (es veuen l'un a l'altre)",
    "Adreça de la consola a la xarxa local apuntada, o el QR del portàtil a mà: ____________",
    "A cada barreja, apunteu el codi de recuperació de la quina (menú de la consola) i guardeu-lo com la caixa dels cartrons: Q__ ________ ",
  ],
};
