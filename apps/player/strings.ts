// Every word the player app shows, in plain Catalan. Shared terms come from ui/i18n/ca.ts (a Round is
// "Quina N", a Line "Línia", a Bingo "Quina!", the night "Quina Musical"); this file adds the app's own copy.
// COPY RULE: the phone never says "you won" and never announces a Line or a Quina: players claim them.
import { CA } from '../../packages/ui/i18n/ca.ts';
import type { HeatLevel } from './logic/view.ts';
import type { TabId } from './logic/tabs.ts';

const card = CA.card;

export const S = {
  appTitle: CA.gameTitle,
  round: CA.round,
  roundOf: CA.roundOf,
  specialRound: CA.specialRound,
  card,
  /** A card's number in small print under its name: "nº 123". */
  cardNumber: (id: number) => `nº ${id}`,

  tabs: { ara: 'Ara', cartrons: 'Cartrons', historial: 'Historial', premis: 'Premis', programa: 'Programa' } satisfies Record<TabId, string>,
  tabBar: 'Seccions',

  help: 'Ajuda',
  soundOn: 'So activat',
  soundOff: 'So apagat',

  // Adding cards
  addCard: 'Afegir cartró',
  padTitle: 'Afegir un cartró',
  padHint: 'Escriu el número que surt al teu cartró.',
  padEmpty: 'Número del cartró',
  padDelete: 'Esborrar l’última xifra',
  padAdd: 'Afegir',
  close: 'Tancar',
  addError: {
    invalid: 'Aquest número no és vàlid.',
    duplicate: (id: number) => `El ${card(id).toLowerCase()} ja és en aquest mòbil.`,
    full: (max: number) => `Ja tens ${max} cartrons, que és el màxim.`,
    unknown: (id: number) => `No hi ha cap cartró amb el número ${id}.`,
  },
  added: (id: number) => `${card(id)} afegit`,

  // Cards
  cardsTitle: 'Els teus cartrons',
  noCards: 'Encara no tens cap cartró.',
  noCardsHint: 'Escaneja el codi QR del teu cartró amb la càmera del mòbil, o escriu-ne el número.',
  notPlaying: 'No juguen en aquesta quina',
  specialRule: 'A la quina especial només compten els cartrons especials.',
  normalRule: 'Els cartrons especials només juguen a la quina especial.',
  /** A round that plays another printed type than its kind's usual one (card-types.json's name). */
  typeRule: (name: string) => `En aquesta quina només compten els cartrons de tipus «${name}».`,
  unknownCard: 'No trobem aquest cartró.',
  loadingCards: 'Carregant els cartrons…',
  catalogError: 'No s’han pogut carregar els cartrons. Ho tornem a provar…',
  rename: 'Nom i icona',
  renameTitle: (id: number) => `Nom i icona del ${card(id).toLowerCase()}`,
  iconLabel: 'Icona',
  iconHint: 'Cada cartró en té una de diferent',
  iconTaken: (icon: string, owner: string) => `${icon}: ja la fa servir ${owner}`,
  nameLabel: 'Nom (opcional)',
  namePlaceholder: 'Per exemple: Àvia',
  save: 'Desar',
  cancel: 'Cancel·lar',
  remove: 'Treure',
  removeTitle: (id: number) => `Treure el ${card(id).toLowerCase()}?`,
  removeText: 'Deixaràs de veure’l en aquest mòbil. El pots tornar a afegir quan vulguis.',
  removeYes: 'Sí, treure’l',
  cell: (title: string, marked: boolean) => `${title}${marked ? `: ${CA.landed.toLowerCase()}` : ''}`,
  markLabel: (mark: string) =>
    (({ corn: 'Gra de blat de moro', shootingStar: 'Estel fugaç', bauble: 'Bola de Nadal', tree: 'Arbre de Nadal', heart: 'Cor', crown: 'Corona de rei', grapes: "Raïm de Cap d'Any", snowflake: 'Floc de neu', topHat: 'Barret de copa', poop: 'Caca del Tió' }) as Record<string, string>)[mark] ?? mark,

  // Ara
  nowPlaying: CA.nowPlaying,
  previous: CA.previous,
  reelSpinning: 'Sona la ruleta…',
  reelWaiting: 'Quina sonarà?',
  noSongYet: 'Encara no ha sonat cap cançó.',
  heatTitle: 'Emoció',
  heatLevel: { cold: 'Tranquil·la', warm: 'Animada', hot: 'Calenta', fire: 'Que crema!' } satisfies Record<HeatLevel, string>,

  // Before the Game
  welcome: 'Benvinguts a la Quina Musical!',
  howToPlayTitle: 'Com es juga',
  howToPlay: [
    'Quan soni una cançó del teu cartró, marca-la amb un gra de blat de moro.',
    'Amb una fila sencera, crida «Línia!». Amb tot el cartró ple, crida «Quina!».',
    'Els presentadors comproven el cartró davant de tothom.',
  ],
  startsAround: (time: string) => `Comencem cap a les ${time}`,
  seePrizes: 'Veure els premis',
  seeSchedule: 'Veure el programa',

  // Round start
  shuffling: 'Barrejant les cançons…',
  prizesOf: (n: number) => `Premis de la ${CA.round(n)}`,

  // Interval
  interval: CA.scene.interval,
  nextRound: CA.nextRound,
  startsIn: (mmss: string) => `Comença d’aquí a uns ${mmss}`,
  startsSoon: 'Comença ben aviat',
  lastWinners: 'Guanyadors de la quina anterior',

  // After the Game
  thanks: CA.thanks,
  summary: 'Resum de la nit',
  seeYou: 'Fins l’any que ve!',

  // Check and Celebration
  checking: CA.checking,
  checkFor: { line: 'Línia', bingo: 'Quina' },
  checkValid: CA.checkValid,
  checkInvalid: CA.checkInvalid,
  shout: CA.shout,
  winningCards: 'Cartrons guanyadors',

  // Pause, offline, reconnecting
  pause: CA.pause,
  offline: CA.offline,
  overlayHint: 'Els teus cartrons continuen aquí.',
  seeCards: 'Veure els meus cartrons',
  reconnecting: 'Reconnectant…',
  connected: 'Connectat',
  noticeLabel: 'Avís',

  // Premis
  prizesTitle: 'Premis',
  prize: CA.prize,
  sponsoredBy: CA.sponsoredBy,
  noPrize: 'Per anunciar',
  morePrizes: CA.morePrizes,
  /** A round whose prizes aren't revealed yet (PrizeRound.lockedUntil). */
  prizesLocked: { intro: 'Es revelen quan comenci la quina', presenters: 'Secrets: es revelaran durant la nit' },
  noPlan: 'Els premis encara no s’han anunciat.',
  winners: CA.winners,
  roundState: { done: 'Feta', current: 'Ara', next: 'La següent', later: '' },

  // Programa
  scheduleTitle: 'Programa',
  notStarted: 'Encara no hem començat.',
  endsAround: (time: string) => `Acabarem cap a les ${time}`,
  around: (time: string) => `cap a les ${time}`,
  roundsPlanned: (n: number) => `${n} quines`,

  // Historial
  historyTitle: 'Historial',
  noHistory: 'Encara no ha sonat cap cançó.',
  songCount: (n: number) => (n === 1 ? '1 cançó' : `${n} cançons`),
  /** A song's icons in Historial: "Al cartró Gra de blat de moro i Lluna". */
  onCards: (names: readonly string[]) => `Als teus cartrons: ${names.join(', ')}`,

  // Last year's links
  legacyTitle: 'Aquest cartró és de l’any passat',
  otherEditionTitle: 'Aquest cartró no és d’aquest any',
  legacyText: 'Els cartrons d’enguany porten un codi QR nou. Escaneja’l, o escriu el número del teu cartró.',
  ok: 'D’acord',

  // Help
  helpTitle: 'Ajuda',
  soundsLabel: 'Sons de la pantalla',
  on: 'Sí',
  off: 'No',
  privacy: 'Els teus cartrons només es guarden en aquest mòbil. No cal cap compte.',
  install: 'Si vols, pots afegir la Quina Musical a la pantalla d’inici des del menú del navegador.',
  wipeData: 'Esborrar dades',
  wipeTitle: 'Esborrar totes les dades?',
  wipeText: 'Es trauran tots els teus cartrons i noms d’aquest mòbil.',
  wipeYes: 'Sí, esborrar-ho tot',
  wiped: 'Dades esborrades',
} as const;
