<!--
  The gallery's collapsed cards (D289, the phone's option A; components-v2.md § 5 D7, D8): CardTile in its states (the
  count, the song playing now, the rosette alone, «LÍNIA!» and «QUINA!» in the map's place, the card just added, the
  white and black cards, a long name), the resting headers on all ten colours, and the Scribble in its three places,
  gold on the night and ink on the your-song gold. Captions in English; the words on the pieces are UI content.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import CardTile, { type TileCell } from '../../../packages/ui/components/CardTile.svelte';
  import Scribble from '../../../packages/ui/components/Scribble.svelte';
  import CardMark from '../../player/components/CardMark.svelte';
  import '../../player/components/tiles.css';
  import './tiles-section.css';

  let { cell }: { cell: Snippet<[string, Snippet]> } = $props();

  /** A map from a pattern: 1 marked, 0 empty, P marked and playing (the running dashes), row by row. */
  const map = (pattern: string): TileCell[] => [...pattern].map((c) => ({ marked: c !== '0', ring: c === 'P' }));
  const TILT = [-9, 6, -3, 12, -12, 4, 9, -6, 2, -14, 7, -1];
  const NAMES = ['Àvia', '#57', 'Tieta', 'Pare', 'Germà', 'Jo', '#412', 'Cosina', 'Avi', 'Cosins'];
</script>

{#snippet chip(identity: number)}<span class="swatch"><CardMark {identity} decorative /></span>{/snippet}
{#snippet kernel(identity: number, i: number)}<span class="card-tile__mark" style:--tilt="{TILT[i]}deg"><span class="card-tile__bob" data-bob><CardMark {identity} decorative /></span></span>{/snippet}

<section class="ds-gallery__section" aria-labelledby="tiles">
  <h2 id="tiles">Collapsed cards (D7 · CardTile, D8 · Scribble; D289)</h2>
  <p class="ds-prose">
    With 2+ cards playing a round, the phone's Cartrons shows each as a tile, two to a row (one card: the full card). A tile is its
    card's header (mark, name or «#57», the count) over its 4 × 3 map, edge to edge with the same margin all round; a tap opens the
    whole card over the dimmed home. Marks on a tile carry <code>data-bob</code> (the beat's bob is another helper's).
  </p>

  <h3>D7 · CardTile</h3>
  <div class="ds-gallery__grid ds-gallery__grid--tiles">
    {#snippet t1()}<CardTile identity={1} label="Àvia" cells={map('011010110100')} count={2} countLabel="En falten 2" aria-label="Àvia">{#snippet mark()}{@render chip(1)}{/snippet}{#snippet cellMark(i)}{@render kernel(1, i)}{/snippet}</CardTile>{/snippet}
    {@render cell('counting: the paper pill', t1)}
    {#snippet t2()}<CardTile identity={2} label="#57" cells={map('1001P1001110')} count={1} countLabel="En falta 1" countColor="orange" stripes glow="own" aria-label="#57">{#snippet mark()}{@render chip(2)}{/snippet}{#snippet cellMark(i)}{@render kernel(2, i)}{/snippet}</CardTile>{/snippet}
    {@render cell('holding the song playing now: its cell’s running dashes, the header’s stripes, its own glow, the orange count (no ring on a tile)', t2)}
    {#snippet t3()}<CardTile identity={6} label="Jo" cells={map('010010P01000')} count={3} countLabel="En falten 3" countColor="orange" stripes glow="own" aria-label="Jo">{#snippet mark()}{@render chip(6)}{/snippet}{#snippet cellMark(i)}{@render kernel(6, i)}{/snippet}</CardTile>{/snippet}
    {@render cell('a warm colour holding it: the orange count’s paper halo', t3)}
    {#snippet t4()}<CardTile identity={4} label="Pare" cells={map('111110101101')} count={0} countLabel="No en falta cap" aria-label="Pare">{#snippet mark()}{@render chip(4)}{/snippet}{#snippet cellMark(i)}{@render kernel(4, i)}{/snippet}</CardTile>{/snippet}
    {@render cell('0 to go: the rosette alone, a sticker (no frame)', t4)}
    {#snippet t5()}<CardTile identity={1} label="Àvia" cells={map('111P01100000')} count={0} countLabel="No en falta cap" countColor="orange" stamp="Línia!" stripes glow="own" aria-label="Àvia">{#snippet mark()}{@render chip(1)}{/snippet}{#snippet cellMark(i)}{@render kernel(1, i)}{/snippet}</CardTile>{/snippet}
    {@render cell('«LÍNIA!» in the map’s place (line-card): the landing completed a row; until the next landing or the validation', t5)}
    {#snippet t6()}<CardTile identity={5} label="Germà" cells={map('11111111111P')} count={0} countLabel="No en falta cap" countColor="orange" stamp="Quina!" stripes glow="own" aria-label="Germà">{#snippet mark()}{@render chip(5)}{/snippet}{#snippet cellMark(i)}{@render kernel(5, i)}{/snippet}</CardTile>{/snippet}
    {@render cell('«QUINA!» (quina-card): the whole card; no card mark on it, the header has it', t6)}
    {#snippet t7()}<CardTile identity={5} label="Germà" cells={map('111111111111')} count={0} countLabel="No en falta cap" stripes aria-label="Germà">{#snippet mark()}{@render chip(5)}{/snippet}{#snippet cellMark(i)}{@render kernel(5, i)}{/snippet}</CardTile>{/snippet}
    {@render cell('a full card after its song passed, unclaimed: the stripes stay until the Quina is validated', t7)}
    {#snippet t8()}<CardTile identity={7} label="#412" cells={map('000000000000')} count={4} countLabel="En falten 4" glow="gold" aria-label="#412">{#snippet mark()}{@render chip(7)}{/snippet}{#snippet cellMark(i)}{@render kernel(7, i)}{/snippet}</CardTile>{/snippet}
    {@render cell('just added (D241): the gold ring and glow; nothing landed on it yet', t8)}
    {#snippet t9()}<CardTile identity={8} label="Cosina" cells={map('100110010011')} count={2} countLabel="En falten 2" aria-label="Cosina">{#snippet mark()}{@render chip(8)}{/snippet}{#snippet cellMark(i)}{@render kernel(8, i)}{/snippet}</CardTile>{/snippet}
    {@render cell('the white card (R10)', t9)}
    {#snippet t10()}<CardTile identity={9} label="Avi" cells={map('0110P0011001')} count={2} countLabel="En falten 2" countColor="orange" stripes glow="own" aria-label="Avi">{#snippet mark()}{@render chip(9)}{/snippet}{#snippet cellMark(i)}{@render kernel(9, i)}{/snippet}</CardTile>{/snippet}
    {@render cell('the black card (R10), holding the song playing now', t10)}
    {#snippet t11()}<CardTile identity={10} label="Superestrelladelanit" cells={map('010001100010')} count={3} countLabel="En falten 3" aria-label="Superestrelladelanit">{#snippet mark()}{@render chip(10)}{/snippet}{#snippet cellMark(i)}{@render kernel(10, i)}{/snippet}</CardTile>{/snippet}
    {@render cell('a long name (R9): one line, an ellipsis', t11)}
  </div>

  <h4>Resting cards: the header alone, three to a row, nothing at its end</h4>
  <ul class="ds-gallery__resting">
    {#each NAMES as name, i (name)}
      <li><CardTile compact identity={i + 1} label={name} role="group" aria-label={name}>{#snippet mark()}{@render chip(i + 1)}{/snippet}</CardTile></li>
    {/each}
  </ul>

  <h3>D8 · Scribble (Caveat Brush, the handwriting face: 26 KB, only here)</h3>
  <p class="ds-gallery__note">
    T3's note until a tile is tapped: in the empty last cell (odd), under the tiles with room (even), else above the first row
    pointing at the second tile. The arrow never crosses the words and stops short of the tile. Gold on the night; ink on the
    your-song gold. With motion the line draws itself, then its head, then the words fade in.
  </p>
  <div class="ds-gallery__grid ds-gallery__grid--scribbles">
    {#each ['gold', 'ink'] as const as color (color)}
      {#snippet s1()}<div class="ds-gallery__scribble" data-ground={color === 'ink' ? 'gold' : 'night'} data-shape="row"><Scribble words="Toca per veure’l!" point="up" {color} /></div>{/snippet}
      {@render cell(`under the tiles (even), ${color === 'ink' ? 'ink on the gold' : 'gold on the night'}`, s1)}
      {#snippet s2()}<div class="ds-gallery__scribble" data-ground={color === 'ink' ? 'gold' : 'night'} data-shape="above"><Scribble words="Toca per veure’l!" point="down" {color} /></div>{/snippet}
      {@render cell(`above the first row (more than 4), ${color}`, s2)}
      {#snippet s3()}<div class="ds-gallery__scribble" data-ground={color === 'ink' ? 'gold' : 'night'} data-shape="cell"><Scribble words="Toca per veure’l!" point="left" {color} /></div>{/snippet}
      {@render cell(`the empty last cell (odd), ${color}`, s3)}
    {/each}
  </div>
</section>
