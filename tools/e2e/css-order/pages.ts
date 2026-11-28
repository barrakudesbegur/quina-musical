// The screens the CSS order check (check.ts) loads in development and in the build: every app on the demo fixtures
// (packages/ui/fixtures/states.ts), at the size it runs at, with the drawers and menus open through their URL hints
// or a click. Add a screen here when it brings a stylesheet or a component no other screen shows. (The console's
// `?wii=demo` is development only, so it can't compare: the gallery shows the Wii pieces instead.)

export interface CheckPage {
  /** Unique, short: the report's and the screenshots' name. */
  name: string;
  /** Path and query on the relay. */
  path: string;
  width: number;
  height: number;
  /** A selector clicked once the page has settled (a menu with no URL hint). */
  click?: string;
  /** A selector focused last, from the keyboard's side (`:focus-visible`), for a field's or a key's focus ring. */
  focus?: string;
  /** In the gallery's own build only (the gallery is development only: no shipped page carries it). */
  gallery?: true;
}

const PHONE = { width: 390, height: 844 };
const TABLET = { width: 1194, height: 834 };
const PROJECTOR = { width: 1440, height: 810 };
/** The projector at 16:10 (D276): the box pillarboxed less, the screen-wide layers reaching into a narrower bleed. */
const PROJECTOR_16_10 = { width: 1440, height: 900 };
const DESKTOP = { width: 1280, height: 900 };

const player = (name: string, query: string): CheckPage => ({ name: `player-${name}`, path: `/player/?${query}`, ...PHONE });
const consolePage = (name: string, query: string, click?: string): CheckPage => ({ name: `console-${name}`, path: `/console/?${query}`, ...TABLET, ...(click ? { click } : {}) });
const focused = (page: CheckPage, name: string, focus: string): CheckPage => ({ ...page, name: `${page.name}-${name}`, focus });
const stage = (name: string, fixture: string): CheckPage => ({ name: `stage-${name}`, path: `/stage/?demo=${fixture}`, ...PROJECTOR });
const stage1610 = (name: string, fixture: string): CheckPage => ({ ...stage(name, fixture), name: `stage-${name}-16x10`, ...PROJECTOR_16_10 });
const admin = (view: string): CheckPage => ({ name: `admin-${view}`, path: `/admin/?demo=play#${view}`, ...DESKTOP });
const gallery = (name: string, query: string, size: { width: number; height: number }): CheckPage => ({ name: `ds-${name}`, path: `/ds/${query}`, ...size, gallery: true });

export const PAGES: readonly CheckPage[] = [
  player('before', 'demo=before'),
  player('historial', 'demo=play&view=historial'),
  player('cartrons', 'demo=play&view=cartrons'),
  // The collapsed cards (D289): «LÍNIA!» and «QUINA!» on a tile, the scribble in the empty cell, the resting headers.
  player('tiles-line', 'demo=lineDone&view=cartrons'),
  player('tiles-quina', 'demo=cardFull&view=cartrons'),
  player('tiles-scribble', 'demo=play&view=cartrons&teach=scribble&cards=123,57,101,412'),
  player('premis', 'demo=play&open=premis'),
  player('horari', 'demo=play&open=horari'),
  player('ajustos', 'demo=play&open=ajustos'),
  player('pad', 'demo=play&open=pad'),
  focused(player('pad', 'demo=play&open=pad'), 'name', '.number-pad__name input'),
  player('install', 'demo=play&open=install&install=steps'),
  player('spin', 'demo=spin'),
  player('check', 'demo=check'),
  player('celebration', 'demo=celebration'),
  player('interval', 'demo=interval'),
  player('desgraciat', 'demo=desgraciat&view=cartrons'),
  player('finale', 'demo=finaleWin'),
  consolePage('before', 'demo=before'),
  consolePage('play', 'demo=play'),
  consolePage('menu', 'demo=play', '.header__menu'),
  focused(consolePage('menu', 'demo=play', '.header__menu'), 'focus', '.menu-group__name input'),
  consolePage('check', 'demo=check'),
  consolePage('review', 'demo=checkReview'),
  consolePage('check-failed', 'demo=checkFailed'),
  consolePage('celebration', 'demo=celebration'),
  consolePage('descans', 'demo=interval'),
  consolePage('pausa', 'demo=intervalPausa'),
  consolePage('sound-test', 'demo=soundTest'),
  consolePage('desgraciat', 'demo=desgraciat'),
  consolePage('finale', 'demo=finale'),
  consolePage('finale-win', 'demo=finaleWin'),
  stage('before', 'before'),
  stage('play', 'play'),
  stage('check', 'check'),
  stage('celebration', 'celebration'),
  stage('interval', 'interval'),
  stage('desgraciat', 'desgraciat'),
  stage('finale', 'finale'),
  stage('finale-celebration', 'finaleCelebration'),
  stage('pause', 'pause'),
  stage1610('before', 'before'),
  stage1610('play', 'play'),
  stage1610('check', 'check'),
  stage1610('check-failed', 'checkCueFallen'),
  stage1610('celebration', 'celebration'),
  stage1610('interval', 'interval'),
  stage1610('desgraciat', 'desgraciat'),
  stage1610('finale', 'finale'),
  stage1610('finale-celebration', 'finaleCelebration'),
  stage1610('pause', 'pause'),
  admin('preparacio'),
  admin('json'),
  admin('nit'),
  admin('eines'),
  admin('xuleta'),
  gallery('console', '', TABLET),
  gallery('console-dark', '?theme=dark', TABLET),
  gallery('phone', '?density=phone', PHONE),
  gallery('projector', '?density=projector', PROJECTOR),
];
