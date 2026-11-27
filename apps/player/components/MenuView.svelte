<script lang="ts">
  // The Ajustos drawer (D87; it was "Menú"; the J2 look, board Mobil-B-J2): the player's cards as plain rows, each
  // with its grip to reorder it (ANIMATIONS.md `card-reorder`; the home screen shows them in this order), its icon,
  // name and number, and its edit and remove buttons; "Afegir cartró"; the settings panel (the Sons switch,
  // ANIMATIONS.md `switch-toggle`; last year's card); "Esborrar les dades d'aquest mòbil".
  // A card's drawers open over this one, and closing them comes back here.
  import { PLAYER_CONFIG } from '../config.ts';
  import { markName } from '../logic/marks-identity.ts';
  import type { PlayerApp } from '../model.svelte.ts';
  import { S } from '../strings.ts';
  import CardMark from './CardMark.svelte';
  import Icon from './Icon.svelte';

  let { app }: { app: PlayerApp } = $props();

  // Dragging a card by its grip: the row follows the finger, the rows it passes make room, and it lands on let go.
  let drag = $state<{ id: number; from: number; y0: number; dy: number; row: number; pointer: number } | null>(null);
  const target = $derived(drag ? Math.max(0, Math.min(app.data.cards.length - 1, drag.from + Math.round(drag.dy / drag.row))) : -1);
  function shiftOf(index: number): number {
    if (!drag || index === drag.from) return 0;
    if (drag.from < target && index > drag.from && index <= target) return -drag.row;
    if (drag.from > target && index >= target && index < drag.from) return drag.row;
    return 0;
  }

  function startDrag(e: PointerEvent, id: number, from: number): void {
    const li = (e.currentTarget as Element).closest('li');
    if (!li) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const gap = parseFloat(getComputedStyle(li.parentElement ?? li).rowGap) || 0;
    drag = { id, from, y0: e.clientY, dy: 0, row: li.getBoundingClientRect().height + gap, pointer: e.pointerId };
  }
  function moveDrag(e: PointerEvent): void {
    if (drag && e.pointerId === drag.pointer) drag.dy = e.clientY - drag.y0;
  }
  function endDrag(e: PointerEvent): void {
    if (!drag || e.pointerId !== drag.pointer) return;
    const { id } = drag;
    const to = target;
    drag = null;
    app.moveCard(id, to);
  }
  function keyMove(e: KeyboardEvent, id: number, index: number): void {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    app.moveCard(id, index + (e.key === 'ArrowUp' ? -1 : 1));
  }
</script>

<div class="menu">
  <section class="menu__cards" aria-labelledby="menu-cards">
    <h3 class="menu__heading" id="menu-cards">{S.myCards}</h3>
    {#if app.data.cards.length}
      <ul class="menu__card-list">
        {#each app.data.cards as card, i (card.id)}
          {@const who = card.name ?? S.markLabel(markName(card.color))}
          <li
            class="menu__card"
            data-anim="card-reorder"
            data-dragging={drag?.id === card.id ? 'true' : undefined}
            data-moving={drag && drag.id !== card.id ? 'true' : undefined}
            style:--card-color="var(--card-color-{card.color})"
            style:--shift="{drag?.id === card.id ? drag.dy : shiftOf(i)}px"
          >
            <button
              type="button"
              class="menu__grip"
              aria-label={S.moveLabel(who)}
              onpointerdown={(e) => startDrag(e, card.id, i)}
              onpointermove={moveDrag}
              onpointerup={endDrag}
              onpointercancel={endDrag}
              onkeydown={(e) => keyMove(e, card.id, i)}
            >
              <Icon name="grip" alone />
            </button>
            <span class="menu__card-mark"><CardMark identity={card.color} decorative /></span>
            <span class="menu__card-name">{who}</span>
            <span class="menu__card-number">{S.cardNumber(card.id)}</span>
            <button type="button" class="menu__card-edit" aria-label={S.editLabel(who)} aria-haspopup="dialog" onclick={() => app.open({ kind: 'rename', cardId: card.id })}>
              <Icon name="edit" alone />
            </button>
            <button type="button" class="menu__card-remove" aria-label={S.removeLabel(who)} aria-haspopup="dialog" onclick={() => app.open({ kind: 'remove', cardId: card.id })}>
              <Icon name="trash" alone />
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="menu__empty">{S.noCards}</p>
    {/if}
    {#if app.data.cards.length < PLAYER_CONFIG.maxCards}
      <button type="button" class="big-button tone-primary menu__add" aria-label={S.addCardLabel} aria-haspopup="dialog" onclick={() => app.open({ kind: 'pad' })}><Icon name="plusOutlined" /> {S.addCard}</button>
    {/if}
  </section>

  <ul class="menu__settings">
    <li class="menu__row">
      <Icon name={app.soundsOn ? 'sound' : 'mute'} />
      <!-- The label toggles the switch too, so the whole row is a target. -->
      <label class="menu__label" id="menu-sounds-label" for="menu-sounds">{S.soundsLabel}</label>
      <button type="button" class="menu__switch" id="menu-sounds" role="switch" aria-labelledby="menu-sounds-label" aria-checked={app.soundsOn} data-anim="switch-toggle" onclick={() => app.toggleSounds()}>
        <span class="menu__switch-knob"></span>
      </button>
    </li>
    <li class="menu__row">
      <button type="button" class="menu__row-button" aria-haspopup="dialog" onclick={() => app.open({ kind: 'anyPassat' })}>
        <Icon name="clockBack" />
        <span class="menu__label">{S.legacyMenuTitle}</span>
        <span class="menu__chevron"><Icon name="chevron" /></span>
      </button>
    </li>
  </ul>

  <button type="button" class="menu__wipe" aria-haspopup="dialog" onclick={() => app.open({ kind: 'wipe' })}>{S.wipeData}</button>
</div>
