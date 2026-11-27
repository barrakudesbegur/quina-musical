// Every word the player app shows, in plain Catalan. Shared terms come from ui/i18n/ca.ts (a Round is
// "Quina N", a Line "Línia", a Bingo "Quina!", the night "Quina Musical"); this file adds the app's own copy.
// COPY RULE: the phone never says "you won" and never announces a Line or a Quina: players claim them.
import { CA } from '../../packages/ui/i18n/ca.ts';
import { roundTitle } from '../../packages/ui/plan.ts';
import type { PublicWinKind } from './feed/public.ts';
import type { HeatLevel } from '../../packages/ui/motion/garland.ts';
import type { AraView } from './logic/tabs.ts';

const card = CA.card;
/** "de" before a name, elided before a vowel sound ("d’Àvia", "d’Helena"), but not before a semivowel ("de Iaia"). */
const ofName = (name: string): string => (/^h?[aeiouàáèéíïòóúü]/i.test(name) && !/^h?[iu][aeiouàáèéíòóú]/i.test(name) ? `d’${name}` : `de ${name}`);
/** "Primer", "Segon"…: the plan's Throws come after a round that isn't the last, so 19 at most (20 rounds). */
const ORDINALS = ['Primer', 'Segon', 'Tercer', 'Quart', 'Cinquè', 'Sisè', 'Setè', 'Vuitè', 'Novè', 'Desè', 'Onzè', 'Dotzè', 'Tretzè', 'Catorzè', 'Quinzè', 'Setzè', 'Dissetè', 'Divuitè', 'Dinovè'] as const;

export const S = {
  appTitle: CA.gameTitle,
  /** A round's name: "Quina 4" by its Quina number, "Quina Especial", "Quina del Desgraciat" (plan.ts roundTitle; by
   * number only: logic/view.ts roundNameOf). */
  roundName: roundTitle,
  card,
  /** A card's number next to its name: "#123" (the user's decision on names on screen). */
  cardNumber: (id: number) => `#${id}`,

  /** The home screen's switch under the drum. */
  araViews: { historial: 'Historial', cartrons: 'Cartrons' } satisfies Record<AraView, string>,
  araSwitch: 'Què vols veure sota el tambor',

  /** The header's button and its drawer (D87: "something else like settings"; it was "Menú"). */
  settings: 'Ajustos',
  /** The two corner buttons, Premis and Horari. */
  cornersLabel: 'Premis i horari',
  /** A stacked drawer's "‹". */
  back: 'Enrere',

  // Adding cards
  /** Every button that adds a card, after its plus: «+ Cartró» (D188, D201). */
  addCard: 'Cartró',
  /** Those buttons' name for screen readers. */
  addCardLabel: 'Afegir un cartró',
  /** The hint to the card holding the song, off screen (card-hint): its name is spoken, never drawn. */
  cardHint: (card: string) => `Veure ${card}, que té aquesta cançó`,
  /** The add-card drawer's title (board Mobil-Afegir-Estats). */
  padTitle: 'Afegir cartró',
  /** The number field's name for screen readers (the field shows only "#" and the digits). */
  padNumber: 'Número del cartró',
  padDelete: 'Esborrar l’última xifra',
  padKeys: 'Teclat del número',
  /** The name field's placeholder: the name is optional. */
  padName: 'Nom',
  /** The add-card QR scan (D141, board Mobil-Afegir-QR). */
  qrButton: 'Escanejar el QR del cartró',
  qrTitle: 'Escaneja el QR',
  qrCamera: 'La càmera',
  qrAsk: 'Per llegir el QR, permet que la Quina faci servir la càmera',
  qrPoint: 'Apunta al QR del cartró',
  qrKeepLooking: 'Segueix buscant: apunta al QR del cartró',
  qrOther: 'Aquest QR no és d’un cartró de la Quina d’enguany',
  qrOffTitle: 'Sense càmera',
  qrDenied: 'No tenim permís per fer servir la càmera. Pots donar-l’hi a la configuració del navegador i tornar a tocar el QR, o escriure el número.',
  qrFailed: 'No s’ha pogut obrir la càmera. Pots escriure el número.',
  qrWrite: 'Escriure el número',
  /** The number typed is already one of the player's cards: whose it is, by its name ("d’Àvia", "de Pere"). */
  alreadyYours: (name: string | null) => (name ? `Ja el tens: és el cartró ${ofName(name)}` : 'Ja el tens: és un dels teus cartrons'),
  /** Closes the pad and shows that card on the home screen. */
  seeCard: 'Veure’l',
  /** Leaving the pad with a number typed (`pad-leave`). */
  discardTitle: (id: number) => `Descartar el #${id}?`,
  /** Leaving «Editar» with an edit not saved (§8 Y3). */
  discardEditTitle: 'Descartar els canvis?',
  discardText: 'Encara no l’has desat.',
  discardYes: 'Descartar',
  discardNo: 'Continuar',
  close: 'Tancar',
  addError: {
    invalid: 'Aquest número no és vàlid.',
    duplicate: (id: number) => `El ${card(id).toLowerCase()} ja és en aquest mòbil.`,
    full: (max: number) => `Ja tens ${max} cartrons, que és el màxim.`,
    unknown: (id: number) => `No hi ha cap cartró amb el número ${id}.`,
  },
  added: (id: number) => `Cartró #${id} afegit`,
  /** «Afegir cartró» after «Desar» (`pad-saved`, §8 Y3; replaces D200's banner): it confirms, then asks. */
  savedTitle: (id: number) => `Cartró #${id} afegit!`,
  savedYours: (count: number) => (count === 1 ? 'El teu cartró' : `Els teus ${count} cartrons`),
  addAnotherAsk: 'Vols afegir un altre cartró?',
  addAnotherHint: 'Si jugues amb més cartrons, o vols seguir els de la família, afegeix-los: el mòbil els segueix tots alhora.',
  savedFull: (max: number) => `Ja en tens ${max}, que és el màxim.`,
  addAnother: 'Un altre',
  done: 'Fet',

  // Cards
  cardsTitle: 'Els teus cartrons',
  noCards: 'Encara no tens cap cartró.',
  noCardsHint: 'Escaneja el codi QR del teu cartró amb la càmera del mòbil, o escriu-ne el número.',
  notPlaying: 'No juguen en aquesta quina',
  /** Which printed type a round plays (card-types.json's name, "Cartró normal"), so a card that rests is explained. */
  unknownCard: 'No trobem aquest cartró.',
  /** The Desgraciat round: a playing card's badge, still standing or seated (sunk by one of its songs). */
  stand: { standing: 'Dempeus', seated: 'Assegut' },
  /** A seated card, for screen readers: which song sank it. */
  sankBy: (title: string) => `Assegut: ha sonat «${title}»`,
  loadingCards: 'Carregant els cartrons…',
  catalogError: 'No s’han pogut carregar els cartrons. Ho tornem a provar…',
  /** The card's edit drawer (the user's phone test, 27 Nov): just «Editar». */
  editTitle: 'Editar',
  iconLabel: 'Icona',
  iconHint: 'Cada cartró en té una de diferent',
  iconTaken: (icon: string, owner: string) => `${icon}: ja la fa servir ${owner}`,
  nameLabel: 'Nom (opcional)',
  namePlaceholder: 'Per exemple: Àvia',
  save: 'Desar',
  /** The rename sheet's way out: it closes without saving the new name (D164, D188, D201). */
  renameDiscard: 'Descarta els canvis',
  removeTitle: (id: number) => `Treure el ${card(id).toLowerCase()}?`,
  removeText: 'Deixaràs de veure’l en aquest mòbil. El pots tornar a afegir quan vulguis.',
  removeYes: 'Sí, treure’l',
  removeNo: 'Mantén el cartró',
  /** The remaining-songs pill's words (#72; the pill itself shows only the number, or the rosette at 0). */
  remaining: (n: number) => (n === 0 ? 'No en falta cap' : n === 1 ? 'En falta 1' : `En falten ${n}`),
  cell: (title: string, marked: boolean, playing = false) => `${title}${marked ? `: ${CA.landed.toLowerCase()}` : ''}${playing ? ', sona ara' : ''}`,
  markLabel: (mark: string) =>
    (({ corn: 'Gra de blat de moro', shootingStar: 'Estel fugaç', bauble: 'Bola de Nadal', tree: 'Arbre de Nadal', heart: 'Cor', crown: 'Corona de rei', grapes: "Raïm de Cap d'Any", snowflake: 'Floc de neu', topHat: 'Barret de copa', poop: 'Caca del Tió' }) as Record<string, string>)[mark] ?? mark,

  // Ara
  nowPlaying: CA.nowPlaying,
  reelSpinning: 'Sona la ruleta…',
  reelWaiting: 'Quina sonarà?',
  noSongYet: 'Encara no ha sonat cap cançó.',
  heatTitle: 'Emoció',
  heatLevel: { cold: 'Tranquil·la', warm: 'Animada', hot: 'Calenta', fire: 'Que crema!' } satisfies Record<HeatLevel, string>,

  // Before the Game
  welcome: 'Benvinguts a la Quina Musical!',
  startsAround: (time: string) => `Comencem cap a les ${time}`,

  // Round start
  shuffling: 'Barrejant les cançons…',
  /** "Premis de la Quina 4", with the round's name (S.roundName). */
  prizesOf: (name: string) => `Premis de la ${name}`,

  // Interval
  interval: CA.scene.interval,
  /** "Següent: Quina 5", with the round's name (S.roundName). */
  nextRound: CA.nextRound,
  startsIn: (mmss: string) => `Comença d’aquí a uns ${mmss}`,
  startsSoon: 'Comença ben aviat',
  lastWinners: 'Premis de la quina anterior',
  /** The sponsors' logos in the Break and at the end of the night (boards M31, M32; G4's SponsorList, #90). */
  thanksSponsors: 'Gràcies als col·laboradors',

  // After the Game
  thanks: CA.thanks,
  summary: 'Resum de la nit',
  seeYou: 'Fins l’any que ve!',

  // Check and Celebration
  checking: CA.checking,
  checkFor: { line: 'Línia', bingo: 'Quina', standing: CA.standing },
  checkValid: CA.checkValid,
  checkInvalid: CA.checkInvalid,
  shout: CA.shout,
  /** The Celebration when the confirmed winner is one of the phone's own cards (never anyone else's number). The
   * Desgraciat's says «Quina potra!» there only (D190); other phones get no title in that round (`shout`, U6). */
  yourWin: { line: 'La teva línia!', bingo: 'La teva quina!', standing: CA.potra } satisfies Record<PublicWinKind, string | null>,

  // Pause, offline, reconnecting
  pause: CA.pause,
  offline: 'Sense connexió · reconnectant…',
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
  /** A prize already won, by someone (phones never say which card). */
  hasWinner: 'Ja té guanyador',
  /** A prize won by one of the phone's own cards (shown with that card's icon). */
  wonByYou: 'Guanyat amb el teu cartró',
  roundState: { done: 'Feta', current: 'Ara', next: 'La següent', later: '' },
  /** The Premis drawer (D244): P1's round selector, P2's content, «Premis sorpresa» on a locked round. */
  prizesRounds: 'Quines',
  prizesPrev: (name: string | null) => (name ? `Quina anterior: ${name}` : 'Quina anterior'),
  prizesNext: (name: string | null) => (name ? `Quina següent: ${name}` : 'Quina següent'),
  /** Spoken after a round's name while its prizes are secret (the lock says it on screen). */
  prizesSecretName: 'premis secrets',
  /** A bundle's size, beside its kind: «17 premis». */
  prizeCount: (n: number) => (n === 1 ? '1 premi' : `${n} premis`),
  /** Before a bundle's plain prizes (a hamper's staples), on one line. */
  prizesAlso: 'I també:',
  prizesSurprise: 'Premis sorpresa',
  prizesSurpriseNote: { intro: 'Es descobreixen quan comenci la quina.', presenters: 'Es descobriran durant la nit.' },
  /** Above the night's sponsors on a locked round's page. */
  prizesSponsors: 'Col·laboren aquesta nit',

  // Horari (first called "Programa")
  scheduleTitle: 'Horari',
  notStarted: 'Encara no hem començat.',
  /** Horari's first row: the doors open and the cards go on sale (D152). */
  scheduleDoors: 'Venda de cartrons',
  /** A planned Throw's descans in Horari, by its order in the night (D150): "Primer descans", "Segon descans"… */
  scheduleThrow: (order: number) => `${ORDINALS[order - 1]} descans`,
  /** The end of the night, with its expected time. */
  scheduleEnd: 'Fi',
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

  // The menu
  myCards: 'Els meus cartrons',
  editLabel: (who: string) => `Nom i icona: ${who}`,
  removeLabel: (who: string) => `Treure: ${who}`,
  /** A card's grip in Ajustos: drag it, or ↑ and ↓. */
  moveLabel: (who: string) => `Moure ${who}: arrossega, o fes servir les fletxes amunt i avall`,
  soundsLabel: 'Sons',
  legacyMenuTitle: 'El cartró de l’any passat',
  legacyMenuText: 'Els cartrons de l’any passat ja no juguen. Els d’enguany porten un codi QR nou: escaneja’l, o afegeix-lo pel número.',
  // Installing the app (D221): Ajustos's row, the home's button (Chrome), and the iPhone's drawer with the steps
  install: 'Instal·la l’app',
  installed: 'Ja tens l’app',
  installTitle: 'Instal·la l’app',
  installIntro: 'Posa la Quina Musical a la pantalla d’inici: s’obrirà com una app, amb els teus cartrons.',
  installStepsLabel: 'Els passos',
  /** The iPhone's steps (logic/install.ts installSteps): `{}` is the button's name, in bold. Safari's labels in
   *  Catalan as the research has them: to check on a real iPhone set to Catalan (U19). */
  installSteps: {
    more: { text: 'Toca {} al costat de l’adreça', button: '⋯' },
    shareSafari: { text: 'Toca {}', button: 'Compartir' },
    shareOther: { text: 'Toca {} a la barra de l’adreça', button: 'Compartir' },
    addHome: { text: 'Tria {}', button: 'Afegir a la pantalla d’inici' },
    add: { text: 'Deixa «Obrir com a app web» activat i toca {}', button: 'Afegir' },
  },
  installAfter: 'Després obre-la des de la icona de la pantalla d’inici.',

  wipeData: 'Esborrar les dades d’aquest mòbil',
  wipeTitle: 'Esborrar totes les dades?',
  wipeText: 'Es trauran tots els teus cartrons i noms d’aquest mòbil.',
  wipeYes: 'Sí, esborrar-ho tot',
  wipeNo: 'Mantén les dades',
  wiped: 'Dades esborrades',
} as const;
