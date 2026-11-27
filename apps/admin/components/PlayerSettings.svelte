<!-- Player-app settings for every phone (D227): interface sounds on by default, and a message banner with its on/off.
     Admin served from the cloud sends them to the phones (PUT /api/sounds and /api/notice); served by the laptop, they
     are only kept on this device. This device always keeps the last ones, so the form starts from them; served from the
     cloud it then takes what the phones have now (GET /api/notice and /api/sounds), unless the form was already edited. Design system
     components, all silent (Admin has no UI sounds, D208). -->
<script module lang="ts">
  import type { NoticePreset } from '../../../packages/ui/components/types.ts';

  /** Each send state's look. They sit in one polite region that is always there (a region added with its message is
   * often not read); «sending» is only shown, never read (an interstitial state: the button is busy meanwhile); a
   * failure interrupts (an alert). */
  const LOOKS = {
    sending: { layout: 'note', color: 'navy', fill: 'subtle', icon: null, live: 'off' },
    sent: { layout: 'note', color: 'green', fill: 'solid', icon: 'check', live: 'off' },
    failed: { layout: 'note', color: 'red', fill: 'solid', icon: 'close', live: 'assertive' },
    notCloud: { layout: 'note', color: 'orange', fill: 'subtle', icon: 'warning', live: 'off' },
  } as const satisfies Record<string, NoticePreset>;
</script>

<script lang="ts">
  import Button from '../../../packages/ui/components/Button.svelte';
  import Notice from '../../../packages/ui/components/Notice.svelte';
  import Switch from '../../../packages/ui/components/Switch.svelte';
  import TextField from '../../../packages/ui/components/TextField.svelte';
  import type { FetchLike } from '../../../packages/ui/data/cloud-plan.ts';
  import { fetchPlayerSettings, sendPlayerSettings } from '../data/cloud-player-settings.ts';
  import { loadPlayerSettings, savePlayerSettings } from '../data/player-settings-store.ts';
  import { BANNER_MAX_LENGTH, fromCloud, type PlayerSettings, type SendState } from '../logic/player-settings.ts';
  import { S } from '../strings.ts';

  let { cloud }: { cloud: boolean } = $props();

  const fetchImpl: FetchLike = (input, init) => fetch(input, { ...init, credentials: 'same-origin' });
  const initial = loadPlayerSettings();
  let sounds = $state(initial.soundsOnByDefault);
  let banner = $state(initial.banner);
  let bannerOn = $state(initial.bannerOn);
  let send = $state<SendState>({ kind: 'idle' });
  let savedHere = $state<boolean | null>(null);

  const settings = (): PlayerSettings => ({ soundsOnByDefault: sounds, banner: banner.trim(), bannerOn });
  /** The form was touched: the cloud's answer, if it comes later, no longer overwrites it. */
  let touched = false;

  // Served from the cloud: start from what every phone has now, not from what this device last sent (§9).
  $effect(() => {
    if (!cloud) return;
    let live = true;
    void fetchPlayerSettings(fetchImpl).then((now) => {
      if (!live || !now || touched) return;
      const start = fromCloud(settings(), now);
      sounds = start.soundsOnByDefault;
      banner = start.banner;
      bannerOn = start.bannerOn;
    });
    return () => (live = false);
  });

  /** An edit after a send or a save: what was said no longer holds. */
  function edited(): void {
    touched = true;
    if (send.kind !== 'sending') send = { kind: 'idle' };
    savedHere = null;
  }

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    touched = true;
    if (send.kind === 'sending') return;
    const now = settings();
    savedHere = savePlayerSettings(now);
    if (!cloud) return;
    send = { kind: 'sending' };
    send = await sendPlayerSettings(fetchImpl, now);
  }
</script>

<section class="panel surface player-settings" aria-labelledby="player-settings-title">
  <h2 class="panel__title" id="player-settings-title">{S.night.playerTitle}</h2>
  {#if cloud}
    <p class="panel__help">{S.night.playerHelp}</p>
  {:else}
    <Notice {...LOOKS.notCloud} text={S.night.playerNotCloud} />
  {/if}
  <form class="player-settings__form" onsubmit={submit}>
    <Switch layout="row" sound={null} checked={sounds} label={S.night.sounds} note={S.night.soundsHelp} onchange={(on) => ((sounds = on), edited())} />
    <TextField label={S.night.banner} rows={2} maxlength={BANNER_MAX_LENGTH} hint={S.night.bannerHelp(BANNER_MAX_LENGTH)} bind:value={banner} oninput={edited} />
    <Switch layout="row" sound={null} checked={bannerOn} disabled={!banner.trim()} label={S.night.bannerOn} note={S.night.bannerOnHelp} onchange={(on) => ((bannerOn = on), edited())} />
    <div class="panel__actions">
      <Button type="submit" color="gold" sound={null} busy={send.kind === 'sending'} disabled={send.kind === 'sending'} label={cloud ? S.night.send : S.night.saveLocal} />
    </div>
    <div class="player-settings__status" aria-live="polite">
    {#if send.kind === 'sending'}
      <Notice {...LOOKS.sending} progress="dots" text={S.night.sending} />
    {:else if send.kind === 'sent'}
      <Notice {...LOOKS.sent} text={S.night.sent} />
    {:else if send.kind === 'failed'}
      <Notice {...LOOKS.failed} text={S.night.sendFailed(send.status)} />
    {:else if !cloud && savedHere !== null}
      <Notice {...(savedHere ? LOOKS.sent : LOOKS.failed)} text={savedHere ? S.night.savedLocal : S.night.saveLocalFailed} />
    {/if}
    </div>
  </form>
</section>

<style>
  .player-settings__form {
    display: grid;
    gap: var(--space-3);
  }
</style>
