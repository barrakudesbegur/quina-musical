<!--
  G4 · SponsorList (the phone): every sponsor as a big logo tile, two a row, in a list that scrolls with its page (the
  user's canvas comment #90, D-v). A tap opens the logo larger in a modal dialog with the sponsor's name; the logo grows
  out of its tile and shrinks back into it on close (ANIMATIONS.md › logo-open: a same-document view transition; reduced
  motion fades). The dialog is native (showModal, Esc, back, a tap outside), named by the sponsor's name.
-->
<script lang="ts">
  import { tick } from 'svelte';
  import IconButton from './IconButton.svelte';
  import { CA } from '../i18n/ca.ts';
  import { imageSources } from '../data/media.ts';
  import LogoTile from './LogoTile.svelte';
  import type { SponsorLogo } from './sponsor-types.ts';
  import './sponsors.css';

  let { sponsors, label = CA.sponsors.list }: { sponsors: readonly SponsorLogo[]; label?: string } = $props();

  const uid = $props.id();
  const NAME = 'sponsor-logo';
  let dialog: HTMLDialogElement | undefined = $state();
  /** The sponsor shown in the dialog, and which tile it came from. */
  let open: number | null = $state(null);
  /** Which side of the morph carries the shared name: the tile (before opening, after closing) or the dialog. */
  let morph: 'tile' | 'dialog' | null = $state(null);
  const shown = $derived(open === null ? null : (sponsors[open] ?? null));
  const sources = $derived(shown?.logo ? imageSources(shown.logo) : null);

  type Transition = { finished: Promise<void> };
  const startViewTransition = (update: () => Promise<void>): Transition | null => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    return 'startViewTransition' in document && !reduced ? document.startViewTransition(update) : null;
  };

  async function show(index: number): Promise<void> {
    open = index;
    morph = 'tile';
    await tick();
    const transition = startViewTransition(async () => {
      morph = 'dialog';
      await tick();
      dialog?.showModal();
    });
    if (!transition) {
      morph = null;
      await tick();
      dialog?.showModal();
      return;
    }
    await transition.finished.catch(() => {});
    morph = null;
  }

  /** Closed without hide() (a second Esc the browser didn't let us intercept): no morph, just tidy up. */
  let closing = false;
  function closed(): void {
    if (closing) return;
    morph = null;
    open = null;
  }

  /** ✕, Esc, back or a tap outside: the logo shrinks back into its tile, then the dialog is gone. */
  async function hide(): Promise<void> {
    if (!dialog?.open || closing) return;
    closing = true;
    morph = 'dialog';
    await tick();
    document.documentElement.dataset.logoClosing = '';
    const transition = startViewTransition(async () => {
      dialog?.close();
      morph = 'tile';
      await tick();
    });
    if (transition) await transition.finished.catch(() => {});
    else dialog?.close();
    delete document.documentElement.dataset.logoClosing;
    morph = null;
    open = null;
    closing = false;
  }
</script>

<ul class="sponsor-list" aria-label={label}>
  {#each sponsors as sponsor, i (`${sponsor.name}|${sponsor.logo}`)}
    <li>
      <LogoTile {sponsor} label={CA.sponsors.show(sponsor.name)} onclick={() => show(i)} imgStyle={morph === 'tile' && open === i ? `view-transition-name: ${NAME}` : undefined} />
    </li>
  {/each}
</ul>

<dialog
  bind:this={dialog}
  class="logo-dialog"
  closedby="any"
  aria-labelledby="{uid}-name"
  data-morph={morph ? '' : undefined}
  oncancel={(e) => {
    e.preventDefault();
    void hide();
  }}
  onclose={closed}
>
  {#if shown}
    <IconButton class="logo-dialog__close" icon="close" label={CA.sponsors.close} variant="bare" onclick={hide} />
    {#if sources}
      <picture class="logo-tile__picture">
        {#if sources.jxl}<source type="image/jxl" srcset={sources.jxl} />{/if}
        <img class="logo-dialog__logo" src={sources.src} alt="" decoding="async" style:view-transition-name={morph === 'dialog' ? NAME : undefined} />
      </picture>
    {/if}
    <h1 class="logo-dialog__name" id="{uid}-name">{shown.name}</h1>
  {/if}
</dialog>
