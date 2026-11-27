// The ninos the screens ship (components-v2.md F1): Barrakudes' figures as game-style stickers, generated from
// brand/ninos/figures by tools/ninos/stickers.ts into packages/ui/assets/ninos/. One URL per pose, written out so Vite
// bundles each file and Node (the tests) resolves the same paths. Which moment shows which poses is NINO_FOR
// (concepts.ts).

export const NINO_POSES = [
  'afro',
  'alt-2',
  'angel',
  'astronauta',
  'ballet',
  'ballet-2',
  'basket',
  'bikini',
  'caiguent',
  'capita',
  'confeti',
  'cuiner',
  'dimoni',
  'espatxarrat',
  'espatxarrat-efecte',
  'fent-una-torre',
  'mag',
  'mans-adalt',
  'meditant',
  'peix',
  'rosa',
  'salt-cames-obertes',
  'sardana',
  'sardana-alt',
  'sentat',
  'snorkel',
  'xocantla',
] as const;

/** A nino by its brand file's name (`brand/ninos/figures/nino-<pose>.svg`). */
export type NinoPose = (typeof NINO_POSES)[number];

const URLS: Record<NinoPose, string> = {
  afro: new URL('./assets/ninos/nino-afro.svg', import.meta.url).href,
  'alt-2': new URL('./assets/ninos/nino-alt-2.svg', import.meta.url).href,
  angel: new URL('./assets/ninos/nino-angel.svg', import.meta.url).href,
  astronauta: new URL('./assets/ninos/nino-astronauta.svg', import.meta.url).href,
  ballet: new URL('./assets/ninos/nino-ballet.svg', import.meta.url).href,
  'ballet-2': new URL('./assets/ninos/nino-ballet-2.svg', import.meta.url).href,
  basket: new URL('./assets/ninos/nino-basket.svg', import.meta.url).href,
  bikini: new URL('./assets/ninos/nino-bikini.svg', import.meta.url).href,
  caiguent: new URL('./assets/ninos/nino-caiguent.svg', import.meta.url).href,
  capita: new URL('./assets/ninos/nino-capita.svg', import.meta.url).href,
  confeti: new URL('./assets/ninos/nino-confeti.svg', import.meta.url).href,
  cuiner: new URL('./assets/ninos/nino-cuiner.svg', import.meta.url).href,
  dimoni: new URL('./assets/ninos/nino-dimoni.svg', import.meta.url).href,
  espatxarrat: new URL('./assets/ninos/nino-espatxarrat.svg', import.meta.url).href,
  'espatxarrat-efecte': new URL('./assets/ninos/nino-espatxarrat-efecte.svg', import.meta.url).href,
  'fent-una-torre': new URL('./assets/ninos/nino-fent-una-torre.svg', import.meta.url).href,
  mag: new URL('./assets/ninos/nino-mag.svg', import.meta.url).href,
  'mans-adalt': new URL('./assets/ninos/nino-mans-adalt.svg', import.meta.url).href,
  meditant: new URL('./assets/ninos/nino-meditant.svg', import.meta.url).href,
  peix: new URL('./assets/ninos/nino-peix.svg', import.meta.url).href,
  rosa: new URL('./assets/ninos/nino-rosa.svg', import.meta.url).href,
  'salt-cames-obertes': new URL('./assets/ninos/nino-salt-cames-obertes.svg', import.meta.url).href,
  sardana: new URL('./assets/ninos/nino-sardana.svg', import.meta.url).href,
  'sardana-alt': new URL('./assets/ninos/nino-sardana-alt.svg', import.meta.url).href,
  sentat: new URL('./assets/ninos/nino-sentat.svg', import.meta.url).href,
  snorkel: new URL('./assets/ninos/nino-snorkel.svg', import.meta.url).href,
  xocantla: new URL('./assets/ninos/nino-xocantla.svg', import.meta.url).href,
};

/** The sticker's URL (bundled by Vite). */
export function ninoUrl(pose: NinoPose): string {
  return URLS[pose];
}
