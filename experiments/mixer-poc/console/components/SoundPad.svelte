<!-- The sound pad: fanfares (stingers) and effects, played by the engine on the PA. -->
<script lang="ts">
  import { SFX_NAMES, STINGER_NAMES, type SoundName } from '@quina/protocol';
  import { getConsole } from '../context.ts';
  import type { IconName } from '../icons.ts';
  import { S, soundText } from '../strings.ts';
  import Icon from './Icon.svelte';

  const model = getConsole();
  const enabled = $derived(model.can('sfx'));
  const groups: readonly { id: string; title: string; icon: IconName; names: readonly SoundName[] }[] = [
    { id: 'stingers', title: S.sounds.stingers, icon: 'fanfare', names: STINGER_NAMES },
    { id: 'effects', title: S.sounds.effects, icon: 'sound', names: SFX_NAMES },
  ];
</script>

<div class="sound-pad">
  {#each groups as group (group.id)}
    <section class="sound-pad__group" data-group={group.id}>
      <h3 class="panel__subtitle">{group.title}</h3>
      <div class="sound-pad__grid">
        {#each group.names as name (name)}
          <button type="button" class="sound-pad__button" data-sound={name} data-anim="press" disabled={!enabled} onclick={() => model.act('sfx', { name })}>
            <Icon name={group.icon} /><span>{soundText(name)}</span>
          </button>
        {/each}
      </div>
    </section>
  {/each}
</div>
