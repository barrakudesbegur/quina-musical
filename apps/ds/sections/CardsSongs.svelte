<!--
  The gallery's cards and songs family (K: components-v2.md § 5, D1–D6; the user's comments #70–#83, comments-27nov.md
  D-q, D-r, D-s). Every component in its variants and states, with the long titles (R9) and the white and black card
  themes (R10). Captions in English; the songs, names and labels are UI content (Catalan, from the fixtures).
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import CardCell from '../../../packages/ui/components/CardCell.svelte';
  import Cover from '../../../packages/ui/components/Cover.svelte';
  import MiniCard from '../../../packages/ui/components/MiniCard.svelte';
  import PlayerCard from '../../../packages/ui/components/PlayerCard.svelte';
  import SongTile from '../../../packages/ui/components/SongTile.svelte';
  import TypeSideLabel from '../../../packages/ui/components/TypeSideLabel.svelte';
  import { COVER_SIZES } from '../../../packages/ui/components/cover.ts';
  import { CELL_LOOKS, cellLook, type CellState } from '../../../packages/ui/components/card-looks.ts';
  import type { Catalog } from '../../../packages/ui/data/catalog.ts';
  import { FIXTURE_SONGS } from '../../../packages/ui/fixtures/states.ts';
  import CardMark from '../../player/components/CardMark.svelte';
  import Reel from '../../player/components/Reel.svelte';
  import './cards-songs.css';

  let { phone, cell }: { phone: boolean; cell: Snippet<[string, Snippet]> } = $props();

  const title = (id: number) => FIXTURE_SONGS[id]?.[0] ?? `Cançó ${id}`;
  const artist = (id: number) => FIXTURE_SONGS[id]?.[1] ?? '';
  /** Long-title songs (R9): «All I Want for Christmas Is You» (1), «SUPERESTRELLA» (60). */
  const LONG = [1, 60];
  const NORMAL = '#cfe8ff';
  const ESPECIAL = '#ffd9e8';
  /** A card's 12 songs, long titles included. */
  const CARD = [2, 17, 60, 16, 11, 15, 31, 1, 3, 5, 14, 20];
  const marked = new Set([2, 17, 15, 31, 3]);
  const near = 16;
  const playingSong = 15;
  const crossed = new Set([17, 31]);
  const catalog: Catalog = {
    cards: new Map(),
    songs: new Map(Object.entries(FIXTURE_SONGS).map(([id, [t, a]]) => [Number(id), { id: Number(id), title: t, artist: a }])),
    cardTypes: null,
  };
  const now = Date.now();

  /** The console's Check example, in the user's order (#77): ok, fail, playing, future ok, no hint. */
  const CHECK_ORDER: { state: CellState; ahead?: number; caption: string }[] = [
    { state: 'landed', caption: 'ok: landed ✓' },
    { state: 'missed', caption: 'fail: ✗, the cover grey' },
    { state: 'playing', caption: 'playing: the ring runs, a play disc' },
    { state: 'upcomingOk', ahead: 2, caption: 'future ok: upcoming (#78), its private ✓ dashed, «+2»' },
    { state: 'pending', caption: 'no hint: still to reveal, as the room sees it' },
  ];
  const CHECK_MORE: { state: CellState; ahead?: number; caption: string }[] = [
    { state: 'upcomingOk', ahead: 1, caption: 'next: the orange ring and glow, «SEGÜENT»' },
    { state: 'upcomingFail', ahead: 3, caption: 'future fail: its private ✗ dashed, «+3»' },
    { state: 'skipped', caption: 'skipped: after the reveals stop' },
    { state: 'idle', caption: 'idle: a Line’s other rows (the Check fades the whole cell)' },
  ];
  const label = (id: number, state: string) => `${title(id)}: ${state}`;
</script>

{#snippet grid(identity: number, crosses = false)}
  <ul class="card-grid">
    {#each CARD as id (id)}
      {@const isMarked = crosses ? crossed.has(id) : marked.has(id)}
      <CardCell
        class="card-grid__cell"
        songId={id}
        title={title(id)}
        label={label(id, isMarked ? 'ha sonat' : 'no ha sonat')}
        coverFallback="empty"
        {...cellLook(isMarked ? (crosses ? 'crossed' : 'marked') : !crosses && id === near ? 'near' : 'empty', { playing: !crosses && id === playingSong })}
      >
        {#if isMarked && crosses}
          <span class="card-grid__cross" aria-hidden="true"><svg class="cross" viewBox="0 0 24 24"><path class="cross__edge" d="M6 6l12 12M18 6L6 18" /><path class="cross__mark" d="M6 6l12 12M18 6L6 18" /></svg></span>
        {:else if isMarked}
          <span class="card-grid__kernel" style:--tilt="{(id % 5) * 6 - 12}deg" aria-hidden="true"><CardMark {identity} decorative /></span>
        {/if}
      </CardCell>
    {/each}
  </ul>
{/snippet}

<section class="ds-gallery__section" aria-labelledby="k">
  <h2 id="k">Cards and songs (D1–D6)</h2>
  <p class="ds-prose">
    Recipes turn game state into these components' generic props through one looks table (§ 11.5:
    <code>card-looks.ts</code>); none paints a colour of its own. The projector builds the same markup in plain TS and shares the CSS.
  </p>

  {#if phone}
    <h3>D1 · PlayerCard</h3>
    <p class="ds-gallery__note">
      Played songs fade a little so the ones to come stand out (#70); titles hyphenate and stop at two lines (#71). The count pill
      shows only where songs are counted (<code>showRemaining</code>, #72), a rosette at 0; DEMPEUS / ASSEGUT take the same place,
      compact too (#73). The song playing now is marked and its dashed orange ring runs (#74; here «Cuídate»). The dashed ink
      outline on a tinted cell is the near-win cue (the one song a card is missing), not «playing».
    </p>
    <div class="ds-gallery__grid ds-gallery__grid--cards">
      {#snippet c1()}
        <PlayerCard identity={1} name="Àvia" number="#123" showRemaining remaining={1} remainingLabel="En falta 1">
          {#snippet mark()}<span class="swatch"><CardMark identity={1} decorative /></span>{/snippet}
          {@render grid(1)}
        </PlayerCard>
      {/snippet}
      {@render cell('counting (showRemaining): 1 to go; played faded, near tinted, playing running', c1)}
      {#snippet c2()}
        <PlayerCard identity={2} name="Superestrella de la Quina Quina" number="#57" glow="gold" showRemaining remaining={0} remainingLabel="No en falta cap">
          {#snippet mark()}<span class="swatch"><CardMark identity={2} decorative /></span>{/snippet}
          {@render grid(2)}
        </PlayerCard>
      {/snippet}
      {@render cell('glow (a win): ringed in the card’s own colour; 0 to go: the rosette; a long name', c2)}
      {#snippet c3()}
        <PlayerCard identity={5} name="Tieta" number="#88" glow="green" data-stand="standing">
          {#snippet mark()}<span class="swatch"><CardMark identity={5} decorative /></span>{/snippet}
          {#snippet status()}<span class="player-card__stand"><span class="stand-badge" data-state="standing">Dempeus</span></span>{/snippet}
          {@render grid(5, true)}
        </PlayerCard>
      {/snippet}
      {@render cell('standing (glow green, DEMPEUS); crossed songs', c3)}
      {#snippet c4()}
        <PlayerCard identity={3} name="Pare" number="#201" sunk data-stand="seated">
          {#snippet mark()}<span class="swatch"><CardMark identity={3} decorative /></span>{/snippet}
          {#snippet perched()}<span class="player-card__nino-slot" aria-hidden="true"><span class="player-card__nino"></span></span>{/snippet}
          {#snippet status()}<span class="player-card__stand"><span class="stand-badge" data-state="seated">Assegut</span></span>{/snippet}
          {@render grid(3, true)}
        </PlayerCard>
      {/snippet}
      {@render cell('sunk: tilted round its centre, room kept for its drop and corners', c4)}
      {#snippet c5()}
        <PlayerCard identity={8} name="Neu" number="#312" showRemaining remaining={3} remainingLabel="En falten 3">
          {#snippet mark()}<span class="swatch"><CardMark identity={8} decorative /></span>{/snippet}
          {@render grid(8)}
        </PlayerCard>
      {/snippet}
      {@render cell('the white card (identity 8, R10)', c5)}
      {#snippet c6()}
        <PlayerCard identity={9} name="Barret" number="#404" showRemaining remaining={2} remainingLabel="En falten 2">
          {#snippet mark()}<span class="swatch"><CardMark identity={9} decorative /></span>{/snippet}
          {@render grid(9)}
        </PlayerCard>
      {/snippet}
      {@render cell('the black card (identity 9, R10): its mark outlined in paper', c6)}
    </div>
    <h4>Long names (R9): the name field's 20 letters, a mark's own name</h4>
    <div class="ds-gallery__grid ds-gallery__grid--cards">
      {#each [['Gra de blat de moro', 'standing'], ['Àvia Montserrat Puig', 'seated'], ['WWWWWWWWWWWWWWWWWWWW', 'count'], ['Superestrelladelanit', 'count']] as [name, kind] (name)}
        {#snippet n()}
          <PlayerCard identity={kind === 'seated' ? 3 : 1} {name} number="#412" compact glow={kind === 'standing' ? 'green' : null} showRemaining={kind === 'count'} remaining={2} remainingLabel="En falten 2" data-stand={kind === 'count' ? undefined : kind}>
            {#snippet mark()}<span class="swatch"><CardMark identity={kind === 'seated' ? 3 : 1} decorative /></span>{/snippet}
            {#snippet perched()}{#if kind !== 'count'}<span class="player-card__nino-slot" aria-hidden="true">{#if kind === 'seated'}<span class="player-card__nino"></span>{/if}</span>{/if}{/snippet}
            {#snippet status()}{#if kind !== 'count'}<span class="player-card__stand"><span class="stand-badge" data-state={kind}>{kind === 'seated' ? 'Assegut' : 'Dempeus'}</span></span>{/if}{/snippet}
          </PlayerCard>
        {/snippet}
        {@render cell(`«${name}», ${kind === 'count' ? 'counting' : kind === 'seated' ? 'ASSEGUT' : 'DEMPEUS'}: two lines at most, the number beside it`, n)}
      {/each}
    </div>
    <div class="ds-gallery__grid ds-gallery__grid--cards">
      {#snippet k1()}<PlayerCard identity={4} name="Germà" number="#312" compact showRemaining remaining={4} remainingLabel="En falten 4">{#snippet mark()}<span class="swatch"><CardMark identity={4} decorative /></span>{/snippet}</PlayerCard>{/snippet}
      {@render cell('compact, counting', k1)}
      {#snippet k2()}<PlayerCard identity={3} name="Pare" number="#201" compact data-stand="seated">{#snippet mark()}<span class="swatch"><CardMark identity={3} decorative /></span>{/snippet}{#snippet status()}<span class="player-card__stand"><span class="stand-badge" data-state="seated">Assegut</span></span>{/snippet}</PlayerCard>{/snippet}
      {@render cell('compact, ASSEGUT (#73)', k2)}
      {#snippet k3()}<PlayerCard identity={8} name="Neu" number="#312" compact showRemaining remaining={0} remainingLabel="No en falta cap">{#snippet mark()}<span class="swatch"><CardMark identity={8} decorative /></span>{/snippet}</PlayerCard>{/snippet}
      {@render cell('compact, white, 0 to go', k3)}
      {#snippet k4()}<PlayerCard identity={9} name="Barret" number="#404" compact>{#snippet mark()}<span class="swatch"><CardMark identity={9} decorative /></span>{/snippet}</PlayerCard>{/snippet}
      {@render cell('compact, black, not counting', k4)}
    </div>
  {:else}
    <p class="ds-gallery__note">D1 · PlayerCard is the phone's: see <a href="?density=phone">the phone page</a>.</p>
  {/if}

  <h3>D2 · CardGrid, CardCell (looks table)</h3>
  {#if !phone}
    <p class="ds-gallery__note">
      The console's Check in the user's order (#77). Marks sit in the cover's centre (#75); playing is a circle with a play icon
      (#76). Upcoming (#78): the cover desaturated and dimmed but recognisable, a dashed grey ring, the private mark dashed in the
      centre, and the presses to its reveal on the bottom edge: quick to spot, clearly not played yet.
    </p>
    <ul class="ds-gallery__cells check-grid">
      {#each CHECK_ORDER as c, i (i)}
        <li class="ds-gallery__cellwrap">
          <ul class="ds-gallery__bare"><CardCell class="check-cell" data-in songId={CARD[i + 7]} title={title(CARD[i + 7])} label={c.caption} {...cellLook(c.state, { ahead: c.ahead ?? null, nextTag: 'Següent' })} /></ul>
          <span class="ds-gallery__caption">{c.caption}</span>
        </li>
      {/each}
    </ul>
    <ul class="ds-gallery__cells check-grid">
      {#each CHECK_MORE as c, i (i)}
        <li class="ds-gallery__cellwrap">
          <ul class="ds-gallery__bare"><CardCell class="check-cell" data-in={c.state === 'idle' ? undefined : true} songId={CARD[i]} title={c.state === 'skipped' ? 'no es destaparà' : title(CARD[i])} label={c.caption} {...cellLook(c.state, { ahead: c.ahead ?? null, nextTag: 'Següent' })} /></ul>
          <span class="ds-gallery__caption">{c.caption}</span>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="ds-gallery__note">The phone's states: empty, marked (played, #70), near (tinted, dashed ink), marked and playing (the running ring), crossed.</p>
  {/if}
  <h4>Long titles (R9)</h4>
  <ul class="ds-gallery__cells {phone ? 'card-grid' : 'check-grid'}">
    {#each LONG as id (id)}
      <li class="ds-gallery__cellwrap">
        <ul class="ds-gallery__bare"><CardCell class={phone ? 'card-grid__cell' : 'check-cell'} data-in songId={id} title={title(id)} label={title(id)} {...CELL_LOOKS.pending} /></ul>
        <span class="ds-gallery__caption">two lines, hyphenated in Catalan</span>
      </li>
    {/each}
  </ul>
  <p class="ds-gallery__note">The looks table: {Object.keys(CELL_LOOKS).join(', ')}. The projector's Check uses the same parts at its scale.</p>

  <h3>D3 · MiniCard + TypeSideLabel</h3>
  <p class="ds-gallery__note">Redrawn (#80): square cells with one even gap, rounded in proportion, a 3D edge in the pastel's own darker shade (R2).</p>
  <div class="ds-gallery__grid">
    {#snippet m1()}<MiniCard customColor={NORMAL} size="label" />{/snippet}
    {@render cell('label · normal', m1)}
    {#snippet m2()}<MiniCard customColor={ESPECIAL} star size="label" />{/snippet}
    {@render cell('label · especial (star)', m2)}
    {#snippet m3()}<span class="ds-gallery__row"><MiniCard customColor={NORMAL} size="chip" /><MiniCard customColor={ESPECIAL} star size="chip" /></span>{/snippet}
    {@render cell('chip', m3)}
    {#snippet m4()}<MiniCard customColor={NORMAL} class="ds-gallery__band-card" tilt={-5} />{/snippet}
    {@render cell('band (the projector’s night bands size it)', m4)}
  </div>
  <div class="ds-gallery__grid">
    {#snippet t1()}<TypeSideLabel label="Normal 1–5" customColor={NORMAL} />{/snippet}
    {@render cell('pending: no ring', t1)}
    {#snippet t2()}<TypeSideLabel label="Normal 6–10" customColor={NORMAL} ring="green" badge="check" />{/snippet}
    {@render cell('ok: green ring + ✓', t2)}
    {#snippet t3()}<TypeSideLabel label="Especial" customColor={ESPECIAL} star ring="red" badge="close" />{/snippet}
    {@render cell('wrong type: red ring + ✗', t3)}
  </div>

  <h3>D4 · Cover</h3>
  <div class="ds-gallery__row ds-gallery__row--end">
    {#each Object.keys(COVER_SIZES) as size (size)}
      <span class="ds-gallery__stack"><Cover songId={7} size={size as keyof typeof COVER_SIZES} /><small>{size}</small></span>
    {/each}
    <span class="ds-gallery__stack"><Cover songId={null} size="l" /><small>no song: note</small></span>
    <span class="ds-gallery__stack"><Cover songId={999} size="l" /><small>missing file: note</small></span>
    <span class="ds-gallery__stack"><Cover songId={16} size="l" blurred /><small>blurred</small></span>
  </div>

  <h3>D5 · SongTile</h3>
  <p class="ds-gallery__note">Long names (#81): two lines with an ellipsis where there's room, one where there isn't; the cover's corners are concentric with the frame's.</p>
  <div class="ds-gallery__grid ds-gallery__grid--wide">
    {#each [7, ...LONG] as id (id)}
      {#snippet r()}<SongTile songId={id} title={title(id)} artist={artist(id)} layout="row" class="ds-gallery__narrow-tile" coverFallback={phone ? 'empty' : 'note'} />{/snippet}
      {@render cell(`row · ${id === 7 ? 'short' : 'long'} (the phone's Historial)`, r)}
    {/each}
    {#if !phone}
      {#each ['tile', 'feature', 'compact', 'result', 'mini'] as const as layout (layout)}
        {#each LONG as id (id)}
          {#snippet r()}<SongTile songId={id} title={title(id)} artist={artist(id)} {layout} kicker={layout === 'feature' ? 'Ara sona' : null} leading={layout === 'mini' ? '+1' : null} class={layout === 'tile' || layout === 'feature' ? '' : 'ds-gallery__narrow-tile'} />{/snippet}
          {@render cell(`${layout} · long${layout === 'tile' ? ' (the projector’s last three)' : ''}`, r)}
        {/each}
      {/each}
    {/if}
    {#each LONG as id (id)}
      {#snippet h()}<div class="ds-gallery__night"><SongTile songId={null} title={title(id)} artist={artist(id)} layout="headline" /></div>{/snippet}
      {@render cell('headline · long (fits the width, two lines)', h)}
    {/each}
  </div>

  <h3>D6 · Drum</h3>
  {#if phone}
    <p class="ds-gallery__note">
      A real cylinder (#82, #83): one transform per tile round one axis, the radius from the tile count with a gap, back faces
      hidden. Drag it sideways: a stiff wobble of at most 4° that springs back (drum-tug). It morphs from the full look to the strip
      by <code>--reel-collapse</code> (0 → 1, transforms and opacity only: drum-collapse), which the phone home drives from its scroll
      and its swipe; <code>compact</code> pins it to the strip.
    </p>
    <div class="ds-gallery__grid ds-gallery__grid--wide">
      {#snippet d1()}<Reel spin={null} latest={{ position: 4, songId: 7, atMs: now - 5000 }} {catalog} songs={[5, 14, 18, 20, 25, 1, 60, 3, 11, 2]} nowMs={now} clockOffsetMs={0} reduced={false} />{/snippet}
      {@render cell('full, landed', d1)}
      {#snippet d2()}<Reel spin={null} latest={{ position: 4, songId: 1, atMs: now - 5000 }} {catalog} songs={[5, 14, 18, 20, 25, 7, 60, 3, 11, 2]} nowMs={now} clockOffsetMs={0} reduced={false} compact />{/snippet}
      {@render cell('compact (the strip), a long title', d2)}
      {#snippet d5()}<Reel spin={{ startAtMs: now - 1000, landAtMs: null }} latest={{ position: 4, songId: 7, atMs: now - 9000 }} {catalog} songs={[5, 14, 18, 20, 25, 1, 60, 3, 11, 2]} nowMs={now} clockOffsetMs={0} reduced={true} />{/snippet}
      {@render cell('turning: the previous song stays, faded, never «?» (§8 Y2; held still here)', d5)}
      {#snippet d6()}<Reel spin={null} latest={{ position: 4, songId: 7, atMs: now - 5000 }} {catalog} songs={[5, 14, 18, 20, 25, 1, 60, 3, 11, 2]} nowMs={now} clockOffsetMs={0} reduced={false} compact marks={[1, 5, 9]} />{/snippet}
      {@render cell('compact, with the marks of the cards holding the song (§8 Y2)', d6)}
      {#snippet d7()}<div class="ds-gallery__gold"><Reel spin={null} latest={{ position: 4, songId: 7, atMs: now - 5000 }} {catalog} songs={[5, 14, 18, 20, 25, 1, 60, 3, 11, 2]} nowMs={now} clockOffsetMs={0} reduced={false} /></div>{/snippet}
      {@render cell('on the your-song gold: the sides fade by a mask, into the gold (§8 Y1)', d7)}
      {#snippet d8()}<div class="ds-gallery__gold"><Reel spin={null} latest={{ position: 4, songId: 7, atMs: now - 5000 }} {catalog} songs={[5, 14, 18, 20, 25, 1, 60, 3, 11, 2]} nowMs={now} clockOffsetMs={0} reduced={false} compact marks={[1]} /></div>{/snippet}
      {@render cell('the strip on the gold: its own night panel, the night’s words', d8)}
      {#snippet d4()}<div style:--reel-collapse="0.5"><Reel spin={null} latest={{ position: 4, songId: 7, atMs: now - 5000 }} {catalog} songs={[5, 14, 18, 20, 25, 1, 60, 3, 11, 2]} nowMs={now} clockOffsetMs={0} reduced={false} /></div>{/snippet}
      {@render cell('halfway through the collapse (--reel-collapse 0.5)', d4)}
      {#snippet d3()}<Reel spin={null} latest={null} {catalog} songs={[5, 14, 18, 20, 25, 7, 60, 3, 11, 2]} nowMs={now} clockOffsetMs={0} reduced={false} />{/snippet}
      {@render cell('idle: blurred, nothing landed yet', d3)}
    </div>
  {:else}
    <p class="ds-gallery__note">The phone's drum is on <a href="?density=phone">the phone page</a>; the projector's is the show page's (apps/show/engine › wheel/drum.ts), already one transform per card round a radius from the card count.</p>
  {/if}
</section>
