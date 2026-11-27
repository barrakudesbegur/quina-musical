<!--
  A8 · TextLink: a low-risk, text-only action (components-v2.md § 2 › A8): «Esborrar les dades d'aquest mòbil»,
  «Veure'l». Underlined words in the palette's text colour on the ground (`color`: red, gold…: `--palette-fg`, so red
  is the light red on night), with a hit area of the floor's height. A `<button>` when it opens something (the default),
  an `<a>` when it navigates (`href`). It may only open something, never confirm a destructive choice: that is a
  `Button color='red' variant='soft'` (D188). Pressed, its words travel down 2 px and spring back (#33); it sounds as
  a small button.
-->
<script lang="ts">
  import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
  import type { UiSound } from './types.ts';
  import './text-link.css';

  type Props = Omit<HTMLButtonAttributes & HTMLAnchorAttributes, 'children' | 'class'> & {
    label: string;
    color?: 'red' | 'gold' | 'orange' | 'cyan' | 'green';
    href?: string;
    sound?: UiSound | null;
    class?: string;
  };

  let { label, color = 'gold', href, sound = 'small', class: className = '', ...rest }: Props = $props();
</script>

{#if href}
  <a {...rest as HTMLAnchorAttributes} {href} class="text-link {className}" data-color={color} data-touch={sound ?? 'none'}><span class="text-link__words">{label}</span></a>
{:else}
  <button {...rest as HTMLButtonAttributes} type="button" class="text-link {className}" data-color={color} data-touch={sound ?? 'none'}><span class="text-link__words">{label}</span></button>
{/if}
