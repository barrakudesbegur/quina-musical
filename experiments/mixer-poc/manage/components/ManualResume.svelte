<!-- Plan B manual resume: after an offline restart of the laptop, an admin says which round and song to carry
     on from. Disabled until the engine and the cloud have a restore path (there is no command for it yet). -->
<script lang="ts">
  import { S } from '../strings.ts';
</script>

<section class="panel surface manual-resume" aria-labelledby="resume-title">
  <h2 class="panel__title" id="resume-title">{S.night.resumeTitle}</h2>
  <p class="panel__help">{S.night.resumeHelp}</p>
  <p class="notice notice--pending">{S.night.resumePending}</p>
  <form class="manual-resume__form" onsubmit={(e) => e.preventDefault()}>
    <fieldset disabled class="field-row">
      <legend class="visually-hidden">{S.night.resumeTitle}</legend>
      <label class="field">
        <span class="field__label">{S.night.resumeRound}</span>
        <input type="number" min="1" max="20" step="1" />
      </label>
      <label class="field">
        <span class="field__label">{S.night.resumePosition}</span>
        <input type="number" min="1" step="1" />
      </label>
      <button type="submit">{S.night.resume}</button>
    </fieldset>
  </form>
</section>

<style>
  .manual-resume__form fieldset {
    border: 0;
    padding: 0;
    align-items: end;
  }
</style>
