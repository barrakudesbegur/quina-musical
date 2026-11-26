<script lang="ts">
  // "Icona": the ten card icons in five columns, each in full colour on a round paper chip with an ink border (D131,
  // the user's mix "D" on board "Component-Icona-Opcions"). An icon another of the player's cards already uses sits
  // on faded paper with whose it is on a dark tag along the chip's bottom edge (its name, else "#123"), and can't be
  // picked while a free one is left. The chosen one wears the gold ring and pops as it gets it (ANIMATIONS.md
  // `icon-pick`). A radio group, so it works with a screen reader and the keyboard; each cell is a full touch target.
  import { PLAYER_CONFIG } from '../config.ts';
  import { identityOf, markName, PICKER_ORDER } from '../logic/marks-identity.ts';
  import { identityFree, type SavedCard } from '../logic/storage.ts';
  import { S } from '../strings.ts';
  import CardMark from './CardMark.svelte';

  let {
    others,
    selected,
    onselect,
    legend = true,
  }: {
    others: readonly SavedCard[];
    selected: number;
    onselect: (identity: number) => void;
    /** Show the "Icona" heading (the pad's board has none: it stays for screen readers only). */
    legend?: boolean;
  } = $props();
  const options = $derived(
    PICKER_ORDER.map(identityOf).filter((identity) => identity <= PLAYER_CONFIG.cardColors).map((identity) => {
      const owner = others.find((c) => c.color === identity);
      const free = identityFree(others, identity);
      return { identity, label: S.markLabel(markName(identity)), free, owner: !free && owner ? (owner.name ?? S.cardNumber(owner.id)) : null };
    }),
  );
  /** The icon the player picked here (not the one the sheet opened with): only a pick pops. */
  let picked = $state<number | null>(null);
</script>

<fieldset class="icon-picker">
  <legend class="icon-picker__legend" class:visually-hidden={!legend}>{S.iconLabel}{#if legend}<span class="icon-picker__hint">{S.iconHint}</span>{/if}</legend>
  <div class="icon-picker__grid">
    {#each options as o (o.identity)}
      <label class="icon-picker__option" class:is-selected={o.identity === selected} class:is-taken={!o.free}>
        <input
          type="radio"
          name="card-icon"
          class="icon-picker__input"
          value={o.identity}
          checked={o.identity === selected}
          disabled={!o.free}
          aria-label={o.owner ? S.iconTaken(o.label, o.owner) : o.label}
          onchange={() => {
            picked = o.identity;
            onselect(o.identity);
          }}
        />
        <span class="icon-picker__chip" data-anim={o.identity === selected && o.identity === picked ? 'icon-pick' : undefined} aria-hidden="true">
          <span class="icon-picker__mark"><CardMark identity={o.identity} decorative /></span>
          {#if o.owner}<span class="icon-picker__owner">{o.owner}</span>{/if}
        </span>
      </label>
    {/each}
  </div>
</fieldset>
