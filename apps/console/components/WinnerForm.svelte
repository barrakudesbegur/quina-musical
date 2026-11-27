<!--
  A winner's name and slip number (both optional: a numbered slip is the alternative to a name, docs/event.md) and
  notes, PRIVATE (console and cloud data only), editable at any time. The
  fields start from the engine's values and follow them while not being edited, so consoles stay in sync.
-->
<script lang="ts">
  import { getConsole } from '../context.ts';
  import { S } from '../strings.ts';
  import TextField from '../../../packages/ui/components/TextField.svelte';

  interface Props {
    claimId: string;
    name: string | null;
    /** The numbered slip handed to the winner ("12", "A12"). */
    slip?: string | null;
    notes: string | null;
    /** A heading for the form, e.g. the card. */
    title?: string | null;
  }

  let { claimId, name, slip = null, notes, title = null }: Props = $props();

  const model = getConsole();
  const uid = $props.id();
  // Drafts: reset to the engine's value whenever it changes.
  let nameDraft = $derived(name ?? '');
  let slipDraft = $derived(slip ?? '');
  let notesDraft = $derived(notes ?? '');
  const dirty = $derived(nameDraft.trim() !== (name ?? '') || slipDraft.trim() !== (slip ?? '') || notesDraft.trim() !== (notes ?? ''));
  const saved = $derived(!dirty && Boolean(name || slip || notes));

  function save(e: SubmitEvent): void {
    e.preventDefault();
    model.act('winnerInfo', { claimId, name: nameDraft.trim(), slip: slipDraft.trim(), notes: notesDraft.trim() });
  }
</script>

<form class="winner-form" data-state={dirty ? 'dirty' : saved ? 'saved' : 'empty'} onsubmit={save} aria-labelledby={title ? `${uid}-title` : undefined}>
  {#if title}<h4 class="winner-form__title" id="{uid}-title">{title}</h4>{/if}
  <TextField label={S.winnerForm.name} maxlength={80} autocomplete="off" value={nameDraft} oninput={(e) => (nameDraft = e.currentTarget.value)} />
  <TextField class="winner-form__slip" label={S.winnerForm.slip} maxlength={16} inputmode="text" autocomplete="off" value={slipDraft} oninput={(e) => (slipDraft = e.currentTarget.value)} />
  <TextField label={S.winnerForm.notes} rows={2} maxlength={500} value={notesDraft} oninput={(e) => (notesDraft = e.currentTarget.value)} />
  <div class="winner-form__actions">
    <button type="submit" class="action" data-anim="press" disabled={!dirty || !model.can('winnerInfo')}>{S.winnerForm.save}</button>
    {#if saved}<span class="winner-form__saved" role="status">{S.winnerForm.saved}</span>{/if}
  </div>
  <p class="winner-form__privacy">{S.winnerForm.privacy}</p>
</form>
