<script lang="ts">
  import { S } from '../strings.ts';
</script>

<section class="how-to-play">
  <h3 class="how-to-play__title">{S.howToPlayTitle}</h3>
  <ol class="how-to-play__steps">
    {#each S.howToPlay as step, i (i)}
      <li class="how-to-play__step">{step}</li>
    {/each}
  </ol>
</section>
