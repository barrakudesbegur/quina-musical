<!-- Player-app settings for every phone: interface sounds on by default, and a message banner. Kept on this
     device only until the cloud can send them to the phones. -->
<script lang="ts">
  import { BANNER_MAX_LENGTH } from '../logic/player-settings.ts';
  import { loadPlayerSettings, savePlayerSettings } from '../data/player-settings-store.ts';
  import { S } from '../strings.ts';

  const initial = loadPlayerSettings();
  let sounds = $state(initial.soundsOnByDefault);
  let banner = $state(initial.banner);
  let saved = $state<boolean | null>(null);

  function save(event: SubmitEvent) {
    event.preventDefault();
    saved = savePlayerSettings({ soundsOnByDefault: sounds, banner: banner.trim() });
  }
</script>

<section class="panel surface player-settings" aria-labelledby="player-settings-title">
  <h2 class="panel__title" id="player-settings-title">{S.night.playerTitle}</h2>
  <p class="notice notice--pending">{S.night.playerPending}</p>
  <form class="player-settings__form" onsubmit={save}>
    <label class="field field--inline">
      <input type="checkbox" bind:checked={sounds} oninput={() => (saved = null)} />
      <span>{S.night.sounds}</span>
    </label>
    <p class="field__help">{S.night.soundsHelp}</p>
    <label class="field">
      <span class="field__label">{S.night.banner}</span>
      <textarea rows="2" maxlength={BANNER_MAX_LENGTH} bind:value={banner} oninput={() => (saved = null)}></textarea>
      <span class="field__help">{S.night.bannerHelp(BANNER_MAX_LENGTH)}</span>
    </label>
    <div class="panel__actions">
      <button type="submit">{S.night.saveLocal}</button>
      <span role="status" class="panel__help">
        {#if saved === true}{S.night.savedLocal}{:else if saved === false}{S.night.saveLocalFailed}{/if}
      </span>
    </div>
  </form>
</section>

<style>
  .player-settings__form {
    display: grid;
    gap: var(--space-3);
  }
</style>
