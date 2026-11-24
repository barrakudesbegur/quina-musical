<script lang="ts">
  // "Icona": the eight card icons, each in its own colour (CardMark). Icons another of the player's cards
  // already uses are dimmed and show whose they are, while a free one is left. A radio group, so it works with
  // a screen reader and the keyboard; every option is a full touch target.
  import { PLAYER_CONFIG } from '../config.ts';
  import { markName } from '../logic/marks-identity.ts';
  import { identityFree, type SavedCard } from '../logic/storage.ts';
  import { S } from '../strings.ts';
  import CardMark from './CardMark.svelte';

  let { others, selected, onselect }: { others: readonly SavedCard[]; selected: number; onselect: (identity: number) => void } = $props();
  const options = $derived(
    Array.from({ length: PLAYER_CONFIG.cardColors }, (_, i) => {
      const identity = i + 1;
      const owner = others.find((c) => c.color === identity);
      const free = identityFree(others, identity);
      return { identity, label: S.markLabel(markName(identity)), free, owner: !free && owner ? (owner.name ?? S.cardNumber(owner.id)) : null };
    }),
  );
</script>

<fieldset class="icon-picker">
  <legend class="icon-picker__legend">{S.iconLabel}<span class="icon-picker__hint">{S.iconHint}</span></legend>
  <div class="icon-picker__grid">
    {#each options as o (o.identity)}
      <label class="icon-picker__option" class:is-selected={o.identity === selected} class:is-taken={!o.free} style:--card-ring="var(--card-line-{o.identity}, var(--card-color-{o.identity}))">
        <input
          type="radio"
          name="card-icon"
          class="icon-picker__input"
          value={o.identity}
          checked={o.identity === selected}
          disabled={!o.free}
          aria-label={o.owner ? S.iconTaken(o.label, o.owner) : o.label}
          onchange={() => onselect(o.identity)}
        />
        <span class="icon-picker__mark" aria-hidden="true"><CardMark identity={o.identity} decorative /></span>
        {#if o.owner}<span class="icon-picker__owner" aria-hidden="true">{o.owner}</span>{/if}
      </label>
    {/each}
  </div>
</fieldset>
