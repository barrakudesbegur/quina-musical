<!--
  The gallery's Tokens section: every custom property the page's stylesheets declare, read at runtime from the CSSOM
  (tokens.ts), never copied, so it can't drift from packages/ui/tokens.css or the apps' sheets. Grouped by the name's
  prefix and by the file it comes from: colours by name, the theme roles, the cards' identities and the card types'
  pastels, the console's two themes, type, space, shadows and edges, motion, layers, the design resources' tokens and
  each app's own. Captions in English (GLOSSARY.md); the samples' words are UI content, so Catalan.
-->
<script lang="ts">
  import { untrack, type Snippet } from 'svelte';
  import MiniCard from '../../../packages/ui/components/MiniCard.svelte';
  import StickerTitle from '../../../packages/ui/components/StickerTitle.svelte';
  import TypeSideLabel from '../../../packages/ui/components/TypeSideLabel.svelte';
  import { PALETTE_COLORS } from '../../../packages/ui/components/types.ts';
  import { UNKNOWN_CARD_TYPE_COLOR, roundsByCardType, type PrintedCardType } from '../../../packages/ui/data/card-types.ts';
  import { cardTypesUrlFor, loadCardTypes } from '../../../packages/ui/data/catalog.ts';
  import { SAMPLE_PLAN } from '../../../packages/ui/fixtures/plan.ts';
  import { CSS_LAYERS } from '../../../packages/ui/layers.ts';
  import CardMark from '../../player/components/CardMark.svelte';
  import { CARD_MARKS } from '../../player/logic/marks-identity.ts';
  import {
    easingPoints, formatMs, formatPx, hexOf, lookupIn, msOf, pageLayerOrder, pxOf, readTokenDecls, resolveVars, tidyValue, type TokenDecl,
  } from './tokens.ts';
  import './tokens.css';

  let { density }: { density: 'console' | 'phone' | 'projector' } = $props();
  const mode = untrack(() => density);

  const TOKENS_CSS = 'packages/ui/tokens.css';
  const decls = readTokenDecls();
  /** tokens.css's :root, one declaration per name (the last wins, as in the cascade). */
  const rootDecls = [...new Map(decls.filter((d) => d.file === TOKENS_CSS && d.selector === ':root').map((d) => [d.name, d])).values()];
  const lookup = lookupIn(rootDecls);

  interface Tok {
    name: string;
    raw: string;
    /** The value with its var() references resolved against tokens.css. */
    value: string;
    hex: string | null;
    ms: number | null;
    px: number | null;
    /** The @media (or other condition) it is declared under, when it is. */
    when: string | null;
  }
  const tok = (d: Pick<TokenDecl, 'name' | 'raw'> & Partial<Pick<TokenDecl, 'conditions'>>, look = lookup): Tok => {
    const value = resolveVars(d.raw, look);
    return { name: d.name, raw: d.raw, value, hex: hexOf(value), ms: msOf(value), px: pxOf(value), when: d.conditions?.length ? d.conditions.join(' and ') : null };
  };
  /** A token's key in a list: a name can come back under a condition (reduced motion). */
  const keyOf = (t: Tok) => (t.when ? `${t.name} @ ${t.when}` : t.name);
  const ROOT = rootDecls.map((d) => tok(d));
  const names = new Set(ROOT.map((t) => t.name));
  const has = (prefix: string | RegExp) => ROOT.filter((t) => (typeof prefix === 'string' ? t.name.startsWith(prefix) : prefix.test(t.name)));
  /** A token's reference, when its value is just another token's: «→ --color-night». */
  const refOf = (raw: string) => raw.match(/^var\((--[\w-]+)\)$/)?.[1] ?? null;
  const seen = new Set<string>();
  const take = (list: Tok[]) => (list.forEach((t) => seen.add(t.name)), list);

  /** Group tokens by a key, the groups in first-seen order (or `order`'s first). */
  function groupBy(list: Tok[], key: (t: Tok) => string, order: readonly string[] = []): [string, Tok[]][] {
    const groups = new Map<string, Tok[]>(order.map((k) => [k, []]));
    for (const t of list) groups.set(key(t), [...(groups.get(key(t)) ?? []), t]);
    return [...groups].filter(([, l]) => l.length);
  }
  const colorWord = (t: Tok) => t.name.slice('--color-'.length).split('-')[0] as string;

  // ---- colours ----
  const NAMED = take(ROOT.filter((t) => t.name.startsWith('--color-') && !t.raw.includes('var(')));
  const BY_NAME = groupBy(NAMED, colorWord, PALETTE_COLORS);
  const edgeOf = (t: Tok) => (!t.name.endsWith('-edge') && names.has(`${t.name}-edge`) ? `var(${t.name}-edge)` : null);
  const ROLES = take(ROOT.filter((t) => t.name.startsWith('--color-') && t.raw.includes('var(')));

  // ---- the cards ----
  const CARD_COLORS = take(has(/^--card-color-\d+$/)).sort((a, b) => Number(a.name.split('-').pop()) - Number(b.name.split('-').pop()));
  const CARD_OTHER = take([...has('--card-').filter((t) => !/^--card-color-\d+$/.test(t.name))]);
  const WOOD = has('--color-wood');
  const identityOf = (t: Tok) => Number(t.name.split('-').pop());
  const lineOf = (n: number) => CARD_OTHER.find((t) => t.name === `--card-line-${n}`) ?? null;

  /** The card types as the screens load them (card-types.json next to cards.json), each with whether it plays the Quina
   *  Especial in the sample plan (its MiniCard's star). */
  let cardTypes = $state.raw<PrintedCardType[] | null | 'loading'>('loading');
  const SPECIAL = new Set(roundsByCardType(SAMPLE_PLAN.rounds).filter((r) => r.special).map((r) => r.type));
  const CARD_TYPES_URL = cardTypesUrlFor('/cards/cards.json');
  loadCardTypes(CARD_TYPES_URL).then((types) => (cardTypes = types));

  // ---- the console's themes ----
  const THEME_CSS = 'apps/console/theme.css';
  const themeDecls = (theme: 'light' | 'dark') => decls.filter((d) => d.file === THEME_CSS && new RegExp(`data-theme=["']?${theme}`).test(d.selector));
  const THEMES = (['light', 'dark'] as const).map((theme) => new Map(themeDecls(theme).map((d) => [d.name, tok(d)])));
  const THEME_NAMES = [...new Set([...(THEMES[0]?.keys() ?? []), ...(THEMES[1]?.keys() ?? [])])];

  // ---- type, space, shadows ----
  const FONTS = take(has('--font-'));
  const TEXT = take(has('--text-'));
  const STAGE_TEXT = take(has('--stage-text-'));
  const TITLE = take(has('--title-'));
  const SPACE = take(has('--space-'));
  const RADIUS = take(has('--radius-'));
  const LINES = take(has('--line-width'));
  const TAP = take(has('--tap-'));
  const SHADOWS = take(has(/^--(shadow|edge|shine)-/));
  const SKY = take(has('--sky-'));
  /** palette.css's coloured edges, declared on every [data-color] (R2). */
  const PALETTE_EDGES = [...new Map(decls.filter((d) => d.file === TOKENS_CSS && d.selector.includes('[data-color]') && /^--edge-/.test(d.name)).map((d) => [d.name, d])).values()];

  // ---- motion, layers ----
  const DURATIONS = take(has(/^--(dur|delay)-/));
  const EASES = take(has('--ease-'));
  const Z = take(has('--z-')).sort((a, b) => Number(b.value) - Number(a.value));
  const PAGE_LAYERS = pageLayerOrder();
  const LAYERS_MATCH = PAGE_LAYERS !== null && PAGE_LAYERS.join() === CSS_LAYERS.join();

  // ---- the design resources ----
  const RESOURCE_TOKENS = take(has(/^--(ring-|corner-|default-ring|dur-press|dur-pattern|dur-default-ring|shadow-floating)/));
  /** What the resources layer (ds/resources.css, which base.css imports) sets on its own classes. */
  const RESOURCE_PROPS = decls.filter((d) => d.layers[0] === 'resources');
  const OTHER = ROOT.filter((t) => !seen.has(t.name));

  // ---- the apps' own ----
  /** Each app stylesheet's tokens on its root (.player, .console, the stage's .stage-root), by file. */
  const APP_ROOTS = ['.player', '.console', '.stage-root', '.ds-stage'];
  /** A length of time by its name (--dur-*, --delay-*, --stage-dur-*…) and its value. */
  const isDuration = (t: Tok) => /(^--|-)(dur|delay)-/.test(t.name) && t.ms !== null;
  const appDecls = decls.filter((d) => d.file.startsWith('apps/') && !d.file.startsWith('apps/ds/') && APP_ROOTS.includes(d.selector));
  /** An app's values resolve against its own root tokens over tokens.css's, as on the app's root element. */
  const appLookup = lookupIn([...rootDecls, ...appDecls.filter((d) => !d.conditions.length)]);
  const APP_FILES = groupBy(
    appDecls.map((d) => ({ ...tok(d, appLookup), file: d.file })),
    (t) => (t as Tok & { file: string }).file,
  ).map(([file, list]) => ({ file, durations: list.filter(isDuration), rest: list.filter((t) => !isDuration(t)) }));
  const STAGE_LIFTED = decls.some((d) => d.selector === '.ds-stage');

  // ---- drawing helpers ----
  /** A duration's bar on a log scale from 10 ms to 10 s. */
  const LOG_MIN = 1;
  const LOG_MAX = 4;
  const logShare = (ms: number) => Math.min(1, Math.max(0.02, (Math.log10(Math.max(ms, 1)) - LOG_MIN) / (LOG_MAX - LOG_MIN)));

  /** An easing's curve as an SVG path in a 0..W × 0..H box, its overshoot included. */
  const CW = 168;
  const CH = 120;
  const PAD = 10;
  function curve(points: [number, number][]) {
    const ys = points.map(([, y]) => y);
    const lo = Math.min(0, ...ys);
    const hi = Math.max(1, ...ys);
    const X = (x: number) => PAD + x * (CW - 2 * PAD);
    const Y = (y: number) => CH - PAD - ((y - lo) / (hi - lo)) * (CH - 2 * PAD);
    return {
      d: points.map(([x, y], i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)} ${Y(y).toFixed(1)}`).join(''),
      y0: Y(0),
      y1: Y(1),
      x0: X(0),
      x1: X(1),
      peak: hi > 1 ? hi : null,
    };
  }
  const short = (raw: string, max = 64) => {
    const v = tidyValue(raw);
    return v.length > max ? `${v.slice(0, max - 1)}…` : v;
  };
</script>

{#snippet fig(caption: string, body: Snippet, wide = false)}
  <figure class="ds-gallery__cell" data-wide={wide || undefined}>
    <div class="ds-gallery__stage ds-tok__stage">{@render body()}</div>
    <figcaption>{caption}</figcaption>
  </figure>
{/snippet}

{#snippet swatch(t: Tok, edge: string | null = null, note: string | null = null)}
  <div class="ds-tok__swatch">
    <span class="ds-tok__chip" style:background={t.value} style:--edge={edge ?? undefined} data-edge={edge ? '' : undefined}></span>
    <code class="ds-tok__name">{t.name}</code>
    <span class="ds-tok__value">{t.hex ?? short(t.value)}{#if note}<br />{note}{/if}</span>
  </div>
{/snippet}

{#snippet bars(list: Tok[])}
  <div class="ds-tok__bars">
    <span></span><span class="ds-tok__ticks" aria-hidden="true">{#each ['10 ms', '100 ms', '1 s', '10 s'] as tick, i (tick)}<span style:--at={i / 3}>{tick}</span>{/each}</span><span></span>
    {#each list as t (keyOf(t))}
      <code class="ds-tok__name">{t.name}{#if t.when}<small class="ds-tok__when">{` @media ${t.when}`}</small>{/if}</code>
      <span class="ds-tok__track"><span class="ds-tok__bar" style:--share={logShare(t.ms ?? 1)}></span></span>
      <span class="ds-tok__value">{formatMs(t.ms ?? 0)}{#if refOf(t.raw)}{` = ${refOf(t.raw)}`}{:else if !/^[\d.]+m?s$/.test(t.raw)}{` = ${short(t.raw, 40)}`}{/if}</span>
    {/each}
  </div>
{/snippet}

{#snippet rows(list: Tok[])}
  <dl class="ds-tok__rows">
    {#each list as t (keyOf(t))}
      <div>
        <dt><code class="ds-tok__name">{t.name}</code>{#if t.when}<small class="ds-tok__when">{` @media ${t.when}`}</small>{/if}</dt>
        <dd>
          {#if t.hex}<span class="ds-tok__dot" style:background={t.value}></span>{/if}
          <span class="ds-tok__value">{short(t.raw, 90)}{#if t.hex && t.hex !== t.raw.toLowerCase()}{' · '}{t.hex}{:else if t.px !== null && t.raw.endsWith('rem')}{' · '}{formatPx(t.px)}{/if}</span>
        </dd>
      </div>
    {/each}
  </dl>
{/snippet}

<section class="ds-gallery__section ds-tok" aria-labelledby="tok">
  <h2 id="tok">Tokens</h2>
  <p class="ds-prose">
    Read from the stylesheets this page loaded (the CSSOM, layers included), never copied: {ROOT.length} tokens on
    <code>:root</code> in <code>{TOKENS_CSS}</code>, then each app’s own. A value that names another token shows the token
    it resolves to; a colour shows its hex.
  </p>

  <!-- ---- colours by name ---- -->
  <h3>Colours by name</h3>
  <p class="ds-gallery__note">Each colour’s slots (the fill first); a fill with an <code>-edge</code> slot wears it as its bottom edge (R2).</p>
  <div class="ds-gallery__grid ds-tok__grid">
    {#each BY_NAME as [word, list] (word)}
      {#snippet s()}
        <div class="ds-tok__swatches">{#each list as t (t.name)}{@render swatch(t, edgeOf(t))}{/each}</div>
      {/snippet}
      {@render fig(`${word} · ${list.length} ${list.length === 1 ? 'token' : 'tokens'}`, s)}
    {/each}
  </div>

  <!-- ---- theme roles ---- -->
  <h3>Theme roles</h3>
  <p class="ds-gallery__note">
    The roles components read, as <code>tokens.css</code> sets them (the night look: the phones and the projector). Each names a
    colour above; the console’s themes override some (Console themes{mode === 'console' ? ', below' : ', on the console’s page'}).
  </p>
  <div class="ds-gallery__grid ds-tok__grid ds-tok__grid--one">
    {#snippet roles()}
      <div class="ds-tok__swatches">{#each ROLES as t (t.name)}{@render swatch(t, null, refOf(t.raw) ? `= ${refOf(t.raw)}` : short(t.raw, 40))}{/each}</div>
    {/snippet}
    {@render fig(`${ROLES.length} roles, in tokens.css’s order, each with the colour it names`, roles, true)}
  </div>

  <!-- ---- card identity ---- -->
  <h3>Card identity</h3>
  <p class="ds-gallery__note">
    A followed card’s colour N goes with mark N (CardMark), in the order new cards take them (D5): corn first.
    {#if CARD_OTHER.length}{CARD_OTHER.map((t) => t.name).join(', ')}: a mark’s outline where ink wouldn’t show.{/if}
  </p>
  <div class="ds-gallery__grid ds-tok__grid ds-tok__grid--cards">
    {#each CARD_COLORS as t (t.name)}
      {@const n = identityOf(t)}
      {@const line = lineOf(n)}
      {#snippet s()}
        <div class="ds-tok__identity">
          <span class="ds-tok__mark"><CardMark identity={n} decorative /></span>
          {@render swatch(t, null, line ? `outline ${line.name}` : null)}
        </div>
      {/snippet}
      {@render fig(`${n} · ${CARD_MARKS[(n - 1) % CARD_MARKS.length]}`, s)}
    {/each}
    {#if WOOD.length}
      {#snippet w()}<div class="ds-tok__swatches">{#each WOOD as t (t.name)}{@render swatch(t)}{/each}</div>{/snippet}
      {@render fig('the marks’ wood: the tree’s trunk, the Tió’s poop', w)}
    {/if}
  </div>

  <!-- ---- card-type pastels ---- -->
  <h3>Card-type pastels</h3>
  <p class="ds-gallery__note">
    Data, not tokens: each printed card type’s <code>color</code> from card-types.json (loaded from <code>{CARD_TYPES_URL}</code>, as the
    screens load it), passed as <code>customColor</code>. The star marks the type that plays the Quina Especial (the sample plan).
  </p>
  <div class="ds-gallery__grid ds-tok__grid">
    {#if cardTypes === 'loading'}
      <p class="ds-gallery__note">Loading card-types.json…</p>
    {:else if cardTypes === null}
      <p class="ds-gallery__note">card-types.json didn’t load (or isn’t what apps/cards writes): the screens would show the stand-in only.</p>
    {:else}
      {#each cardTypes as type (type.type)}
        {#snippet s()}
          <div class="ds-tok__types" lang="ca">
            <MiniCard customColor={type.color} star={SPECIAL.has(type.type)} size="label" />
            {#each type.sides as side (side.side)}<TypeSideLabel label={side.checkLabel} customColor={type.color} star={SPECIAL.has(type.type)} />{/each}
          </div>
        {/snippet}
        {@render fig(`${type.type}: «${type.name}», ${type.color}`, s)}
      {/each}
    {/if}
    {#snippet u()}<div class="ds-tok__types" lang="ca"><TypeSideLabel label="Cartró plata" customColor={UNKNOWN_CARD_TYPE_COLOR} /></div>{/snippet}
    {@render fig(`a type no list names: the neutral stand-in, ${UNKNOWN_CARD_TYPE_COLOR} (UNKNOWN_CARD_TYPE_COLOR)`, u)}
  </div>

  <!-- ---- the console's themes ---- -->
  {#if mode === 'console'}
    <h3>Console themes</h3>
    <p class="ds-gallery__note">What <code>{THEME_CSS}</code> sets on <code>.console[data-theme]</code> (and the page behind it): light, the default, and dark. Lines stay ink in both.</p>
    <div class="ds-gallery__grid ds-tok__grid ds-tok__grid--one">
      {#snippet t()}
        <!-- A table that may scroll sideways is a region the keyboard can reach and scroll. -->
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div class="ds-tok__table-wrap" tabindex="0" role="region" aria-label="Console themes">
          <table class="ds-tok__table ds-tok__themes">
            <thead><tr><th scope="col">token</th><th scope="col">light</th><th scope="col">dark</th></tr></thead>
            <tbody>
              {#each THEME_NAMES as name (name)}
                <tr>
                  <th scope="row"><code class="ds-tok__name">{name}</code></th>
                  {#each THEMES as theme, i (i)}
                    {@const v = theme.get(name)}
                    <td>
                      {#if v}
                        <span class="ds-tok__cellvalue">
                          {#if v.hex}<span class="ds-tok__dot ds-tok__dot--big" style:background={v.value}></span>{/if}
                          <span class="ds-tok__value">{refOf(v.raw) ?? short(v.raw, 40)}{#if v.hex && v.hex !== v.raw.toLowerCase()}<br />{v.hex}{/if}</span>
                        </span>
                      {:else}<span class="ds-tok__value">—</span>{/if}
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/snippet}
      {@render fig('light and dark, side by side (— : the theme leaves it to tokens.css or the other rules)', t, true)}
    </div>
  {/if}

  <!-- ---- type ---- -->
  <h3>Type</h3>
  <div class="ds-gallery__grid ds-tok__grid ds-tok__grid--wide">
    {#each FONTS as t (t.name)}
      {#snippet s()}
        <p class="ds-tok__sample" lang="ca" style:font-family={t.name.includes('weight') ? 'var(--font-body)' : t.value} style:font-weight={t.name.includes('weight') ? t.value : undefined}>Boig per tu</p>
      {/snippet}
      {@render fig(`${t.name}: ${t.raw}`, s)}
    {/each}
  </div>
  <div class="ds-gallery__grid ds-tok__grid ds-tok__grid--one">
    {#snippet ramp()}
      <div class="ds-tok__ramp" lang="ca">
        {#each TEXT as t (t.name)}
          <p style:font-size={t.value}>Boig per tu</p>
          <span class="ds-tok__value"><code class="ds-tok__name">{t.name}</code>{` ${t.raw} · ${formatPx(t.px ?? 0)}`}</span>
        {/each}
      </div>
    {/snippet}
    {@render fig('--text-*: the screens’ type ramp (Nunito 800)', ramp, true)}
    {#if STAGE_TEXT.length}
      {#snippet stage()}
        <div class="ds-tok__ramp ds-tok__ramp--stage" lang="ca">
          {#each STAGE_TEXT as t (t.name)}
            <p style:font-size={t.value}>Boig per tu</p>
            <span class="ds-tok__value"><code class="ds-tok__name">{t.name}</code>{` ${t.raw} · ${formatPx(t.px ?? 0)}`}</span>
          {/each}
        </div>
      {/snippet}
      {@render fig('--stage-text-*: the projector’s sizes (Nunito 800), at the 1440 px box’s scale (the stage scales the box to the screen)', stage, true)}
    {/if}
  </div>
  <div class="ds-gallery__grid ds-tok__grid ds-tok__grid--wide">
    {#snippet t1()}<p class="ds-tok__londrina" lang="ca">Línia!</p>{/snippet}
    {@render fig('Londrina in capitals: --title-stroke painted under the fill (paint-order), --title-drop, --title-tracking', t1)}
    {#snippet t2()}<p class="ds-tok__londrina ds-tok__londrina--sm" lang="ca">Línia!</p>{/snippet}
    {@render fig('small titles: --title-stroke-sm, --title-drop-sm, --title-tracking-sm', t2)}
    {#snippet t3()}<p class="ds-tok__nunito" lang="ca">Boig per tu, de Sau</p>{/snippet}
    {@render fig('Nunito keeps its case (--font-body, --font-weight-strong)', t3)}
    {#snippet t4()}<div class="ds-tok__night" lang="ca"><StickerTitle as="p" size="l" color="gold">9 <span class="unit">s</span></StickerTitle></div>{/snippet}
    {@render fig('a .unit keeps its lower case in a Londrina title (D114)', t4)}
    {#snippet t5()}{@render rows(TITLE)}{/snippet}
    {@render fig('--title-*', t5)}
  </div>

  <!-- ---- space, radius, lines, tap ---- -->
  <h3>Space, radius, lines, tap</h3>
  <div class="ds-gallery__grid ds-tok__grid ds-tok__grid--wide">
    {#snippet sp()}
      <div class="ds-tok__measures">
        {#each SPACE as t (t.name)}
          <code class="ds-tok__name">{t.name}</code><span class="ds-tok__space" style:inline-size={t.value}></span><span class="ds-tok__value">{t.raw} · {formatPx(t.px ?? 0)}</span>
        {/each}
      </div>
    {/snippet}
    {@render fig('--space-*: bars that long', sp)}
    {#snippet ra()}
      <div class="ds-tok__boxes">
        {#each RADIUS as t (t.name)}
          <div class="ds-tok__boxcell"><span class="ds-tok__radius" style:border-radius={t.value}></span><code class="ds-tok__name">{t.name}</code><span class="ds-tok__value">{t.raw}{t.px !== null && !t.raw.endsWith('px') ? ` · ${formatPx(t.px)}` : ''}</span></div>
        {/each}
      </div>
    {/snippet}
    {@render fig('--radius-*: boxes with that radius', ra)}
    {#snippet li()}
      <div class="ds-tok__measures">
        {#each LINES as t (t.name)}
          <code class="ds-tok__name">{t.name}</code><span class="ds-tok__line" style:border-block-start-width={t.value}></span><span class="ds-tok__value">{t.raw}</span>
        {/each}
      </div>
    {/snippet}
    {@render fig(`--line-width*: ink lines that thick${mode === 'console' ? ' (the console’s own --line-width-thin: App tokens)' : ''}`, li)}
    {#snippet ta()}
      <div class="ds-tok__boxes">
        {#each TAP as t (t.name)}
          <div class="ds-tok__boxcell"><span class="ds-tok__tap" style:inline-size={t.value} style:block-size={t.value}></span><code class="ds-tok__name">{t.name}</code><span class="ds-tok__value">{t.raw}</span></div>
        {/each}
      </div>
    {/snippet}
    {@render fig('--tap-*: squares that size', ta)}
  </div>

  <!-- ---- shadows and edges ---- -->
  <h3>Shadows and edges</h3>
  <div class="ds-gallery__grid ds-tok__grid">
    {#each SHADOWS as t (t.name)}
      {#snippet s()}
        <div class="ds-tok__pieces">
          <span class="ds-tok__paper" style:box-shadow={`var(${t.name})`}></span>
          {#if /^--(edge|shine)-/.test(t.name)}<span class="ds-tok__paper ds-tok__paper--orange" style:box-shadow={`var(${t.name})`}></span>{/if}
        </div>
        <span class="ds-tok__value">{t.raw}</span>
      {/snippet}
      {@render fig(`${t.name}${/^--(edge|shine)-/.test(t.name) ? ' (on paper, and on an orange piece)' : ''}`, s)}
    {/each}
    {#each PALETTE_EDGES as d (d.name)}
      {#snippet s()}
        <div class="ds-tok__pieces">
          {#each ['orange', 'cyan', 'navy'] as color (color)}<span class="ds-tok__paper ds-tok__paper--palette" data-color={color} style:box-shadow={`var(${d.name})`}></span>{/each}
        </div>
        <span class="ds-tok__value">{d.raw}</span>
      {/snippet}
      {@render fig(`${d.name}: on every [data-color] (palette.css, R2), in its own edge slot`, s)}
    {/each}
    {#if SKY.length}
      {#snippet s()}
        <span class="ds-tok__sky" style:background-image="var(--sky-stars)" style:background-size="var(--sky-stars-size)" style:background-position="var(--sky-stars-position)"></span>
        <span class="ds-tok__value">{SKY.map((t) => t.name).join(', ')}</span>
      {/snippet}
      {@render fig('the starry night sky behind the phones', s)}
    {/if}
  </div>

  <!-- ---- motion ---- -->
  <h3>Motion</h3>
  <div class="ds-gallery__grid ds-tok__grid ds-tok__grid--one">
    {#snippet d()}{@render bars(DURATIONS.filter((t) => t.ms !== null))}{/snippet}
    {@render fig('--dur-*: every length, on a log scale', d, true)}
  </div>
  <div class="ds-gallery__grid ds-tok__grid">
    {#each EASES as t (t.name)}
      {@const points = easingPoints(t.value)}
      {#snippet e()}
        {#if points}
          {@const c = curve(points)}
          <svg class="ds-tok__curve" viewBox="0 0 {CW} {CH}" aria-hidden="true">
            <rect class="ds-tok__curve-box" x={c.x0} y={c.y1} width={c.x1 - c.x0} height={c.y0 - c.y1} />
            <path class="ds-tok__curve-line" d={c.d} />
          </svg>
        {:else}
          <span class="ds-tok__value">(not drawn)</span>
        {/if}
        <span class="ds-tok__value">{short(t.raw, 120)}</span>
      {/snippet}
      {@render fig(`${t.name}${points && Math.max(...points.map(([, y]) => y)) > 1 ? ` (overshoots to ${Math.max(...points.map(([, y]) => y))})` : ''}`, e)}
    {/each}
  </div>

  <!-- ---- layers and z-index ---- -->
  <h3>Layers and z-index</h3>
  <div class="ds-gallery__grid ds-tok__grid ds-tok__grid--wide">
    {#snippet l()}
      <p class="ds-tok__layers">{#each CSS_LAYERS as layer, i (layer)}<code>{layer}</code>{#if i < CSS_LAYERS.length - 1}<span aria-hidden="true">{' › '}</span>{/if}{/each}</p>
    {/snippet}
    {@render fig(`packages/ui/layers.ts, weakest first; ${LAYERS_MATCH ? 'this page’s @layer statement matches it' : `this page’s statement: ${PAGE_LAYERS?.join(', ') ?? 'none'}`}`, l)}
    {#snippet z()}
      <table class="ds-tok__table">
        <thead><tr><th scope="col">token</th><th scope="col">z-index</th></tr></thead>
        <tbody>{#each Z as t (t.name)}<tr><th scope="row"><code class="ds-tok__name">{t.name}</code></th><td>{t.raw}</td></tr>{/each}</tbody>
      </table>
    {/snippet}
    {@render fig('--z-*, the top first', z)}
  </div>

  <!-- ---- the design resources' tokens ---- -->
  <h3>Design resources' tokens</h3>
  <div class="ds-gallery__grid ds-tok__grid ds-tok__grid--wide">
    {#snippet r()}{@render rows(RESOURCE_TOKENS)}{/snippet}
    {@render fig('tokens.css’s knobs for R1 (rings), R4 (press), R3 (the on pattern’s pan), R7 (corners) and the floating button', r)}
    {#snippet p()}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div class="ds-tok__table-wrap" tabindex="0" role="region" aria-label="What the resources layer sets">
        <table class="ds-tok__table">
          <thead><tr><th scope="col">on</th><th scope="col">token</th><th scope="col">value</th></tr></thead>
          <tbody>
            {#each RESOURCE_PROPS as d, i (i)}
              <tr><td><code>{d.selector}</code></td><th scope="row"><code class="ds-tok__name">{d.name}</code></th><td class="ds-tok__value">{short(d.raw, 70)}</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/snippet}
    {@render fig('what the resources layer (ds/resources.css and ds/mark.css, which base.css imports) sets on its own selectors', p, true)}
  </div>

  {#if OTHER.length}
    <h3>Other tokens</h3>
    <div class="ds-gallery__grid ds-tok__grid ds-tok__grid--wide">
      {#snippet o()}{@render rows(OTHER)}{/snippet}
      {@render fig('tokens.css names no group above takes yet', o)}
    </div>
  {/if}

  <!-- ---- the apps' own ---- -->
  <h3>App tokens</h3>
  <p class="ds-gallery__note">
    {#if mode === 'projector'}
      This page loads no app stylesheet (stage.css is the scenes’ layout){STAGE_LIFTED ? '; the garland’s rules and the stage’s tokens on .stage-root are lifted from it for E2 (apps/ds/stage-garland.ts)' : ''}.
    {:else}
      What the {mode === 'phone' ? 'player’s' : 'console’s'} stylesheets set on the app’s root, by file; durations on the log scale of Motion.
    {/if}
  </p>
  <div class="ds-gallery__grid ds-tok__grid ds-tok__grid--wide">
    {#each APP_FILES as app (app.file)}
      {#if app.durations.length}
        {#snippet d()}{@render bars(app.durations)}{/snippet}
        {@render fig(`${app.file}: its durations (${app.durations.length})`, d, true)}
      {/if}
      {#if app.rest.length}
        {#snippet r()}{@render rows(app.rest)}{/snippet}
        {@render fig(`${app.file}: the rest (${app.rest.length})`, r, true)}
      {/if}
    {/each}
  </div>
</section>
