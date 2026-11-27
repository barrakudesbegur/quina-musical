<script lang="ts">
  // "Icona": the ten card icons in five columns, each in full colour on a round paper swatch (D131). This is the player
  // app's preset over the generic IconPicker (B8; D-c, #50): an icon another of the player's cards already uses is
  // disabled, tagged with whose it is (its name, else "#123", #54), while a free one is left. The chosen one wears the
  // gold ring and pops as it gets it (ANIMATIONS.md `icon-pick`).
  import Picker from '../../../packages/ui/components/IconPicker.svelte';
  import { PLAYER_CONFIG } from '../config.ts';
  import { CARD_MARKS, identityOf, markName } from '../logic/marks-identity.ts';
  import { cardLabel, identityFree, type SavedCard } from '../logic/storage.ts';
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
    CARD_MARKS.map(identityOf).filter((identity) => identity <= PLAYER_CONFIG.cardColors).map((identity) => {
      const owner = others.find((c) => c.color === identity);
      const free = identityFree(others, identity);
      return { value: identity, label: S.markLabel(markName(identity)), disabled: !free, tag: !free && owner ? cardLabel(owner) : null };
    }),
  );
</script>

<Picker
  {options}
  value={selected}
  legend={S.iconLabel}
  legendHidden={!legend}
  hint={S.iconHint}
  name="card-icon"
  nameOf={(o) => (o.tag ? S.iconTaken(o.label, o.tag) : o.label)}
  {onselect}
>
  {#snippet mark(o)}<CardMark identity={o.value} decorative />{/snippet}
</Picker>
