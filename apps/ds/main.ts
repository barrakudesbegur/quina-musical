// The design system's gallery (development only: vite.config.ts leaves apps/ds out of the build). It renders the
// generic components and the design resources in every variant, size and state, at one density per page load, with
// that app's own stylesheet, the way the app shows them: /ds/ (the console, light), /ds/?theme=dark, /ds/?density=phone,
// /ds/?density=projector (the projector's components on the night sky, at the 1440 px box's scale).
// The helpers add their families here; the canvas is redrawn from it.
import '../../packages/ui/tokens.css';
import '../../packages/ui/base.css';
import './gallery.css';
import { mount } from 'svelte';
import Gallery from './Gallery.svelte';

const params = new URLSearchParams(location.search);
const asked = params.get('density');
const density = asked === 'phone' || asked === 'projector' ? asked : 'console';
const theme = params.get('theme') === 'dark' ? 'dark' : 'light';

// Each app's own look, as it loads it (the two apps' stylesheets would collide on one page).
if (density === 'phone') await import('../player/player.css');
else if (density === 'projector') {
  // The projector's components carry their own CSS (packages/ui/components); stage.css is the scenes' layout.
} else {
  await import('../console/theme.css');
  await import('../console/console.css');
}

const target = document.getElementById('app');
if (!target) throw new Error('ds: #app is missing from index.html');
mount(Gallery, { target, props: { density, theme } });
