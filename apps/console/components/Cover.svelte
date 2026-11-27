<!-- A song's cover on the console: the design system's Cover (D4), sized by the console's sm / md / lg classes (a music
     note on navy when there is none or it fails). -->
<script lang="ts">
  import Cover from '../../../packages/ui/components/Cover.svelte';

  let { songId, size = 'md', morph }: { songId: number | null; size?: 'sm' | 'md' | 'lg'; morph?: string } = $props();
</script>

<Cover {songId} class="cover--{size}" morph={morph ?? null} />
