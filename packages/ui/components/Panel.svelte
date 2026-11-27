<!--
  C1 · Panel: a framed area that groups content (components-v2.md § 4). Props say what it draws: `fill` ('surface',
  'snow' (the warmer paper), 'panel' (the night panel)), `border` ('dashed': «only you see this», D15), `line`
  ('normal': the thinner outline), `shadow`, `padding`, and its heading: `kicker` (the small capitals label) and
  `title`. Slots: `actions` (the heading row's end), `children`. A <section> named by its title, else its kicker
  (else pass `aria-label` / `aria-labelledby`); `element` binds the section.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import './panel.css';

  type Props = Omit<HTMLAttributes<HTMLElement>, 'children' | 'class' | 'title'> & {
    fill?: 'surface' | 'snow' | 'panel';
    border?: 'solid' | 'dashed';
    line?: 'bold' | 'normal';
    shadow?: boolean;
    padding?: 's' | 'm';
    kicker?: string | null;
    title?: string | null;
    class?: string;
    element?: HTMLElement | null;
    actions?: Snippet;
    children: Snippet;
  };

  let {
    fill = 'surface',
    border = 'solid',
    line = 'bold',
    shadow = true,
    padding = 'm',
    kicker = null,
    title = null,
    class: className = '',
    element = $bindable(null),
    actions,
    children,
    ...rest
  }: Props = $props();

  const uid = $props.id();
  const named = $derived(title !== null || kicker !== null);
</script>

<section
  bind:this={element}
  {...rest}
  class="panel {className}"
  data-fill={fill}
  data-border={border}
  data-line={line}
  data-shadow={shadow ? undefined : 'false'}
  data-padding={padding}
  aria-labelledby={named ? `${uid}-name` : rest['aria-labelledby']}
>
  {#if named || actions}
    <header class="panel__head">
      {#if title !== null && kicker !== null}
        <div>
          <p class="panel__label">{kicker}</p>
          <h2 class="panel__title" id="{uid}-name">{title}</h2>
        </div>
      {:else if title !== null}
        <h2 class="panel__title" id="{uid}-name">{title}</h2>
      {:else if kicker !== null}
        <h2 class="panel__label" id="{uid}-name">{kicker}</h2>
      {/if}
      {@render actions?.()}
    </header>
  {/if}
  {@render children()}
</section>
