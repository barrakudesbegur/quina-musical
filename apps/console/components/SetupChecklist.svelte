<!-- The setup checklist for the night. Ticks are this device's own (kept in localStorage). -->
<script lang="ts">
  import { getConsole } from '../context.ts';
  import { S } from '../strings.ts';

  const model = getConsole();
  const uid = $props.id();
</script>

<section class="checklist" aria-labelledby="{uid}-title">
  <h4 class="menu-group__field" id="{uid}-title">{S.cheatSheet.checklist}</h4>
  <ul class="checklist__list">
    {#each S.checklist as item (item.id)}
      <li class="checklist__item" data-state={model.checklist.includes(item.id) ? 'done' : 'todo'}>
        <label class="checklist__label" for="{uid}-{item.id}">
          <input id="{uid}-{item.id}" type="checkbox" checked={model.checklist.includes(item.id)} onchange={() => model.toggleChecklist(item.id)} />
          <span>{item.text}</span>
        </label>
      </li>
    {/each}
  </ul>
</section>
