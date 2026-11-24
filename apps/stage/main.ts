// The standalone projector page (/stage/): for development (`?demo=<fixture>`) and for split mode, where the
// projector runs on another device than the show laptop and follows it through the relay. In the show page
// itself the stage is mounted over the drum with `mountStage(el, { bus })` instead (see README.md).
import { relayTokenForPage } from '../../packages/ui/client/pairing.ts';
import '../../packages/ui/tokens.css';
import '../../packages/ui/base.css';
import { ShowClient } from '../../packages/ui/client/show-client.ts';
import { DemoTransport, demoNameFromLocation } from '../../packages/ui/client/demo.ts';
import { ANIM_EVENT, mountStage, type AnimDetail } from './stage.ts';

const root = document.getElementById('stage');
if (!root) throw new Error('stage: #stage is missing from the page');

const demo = demoNameFromLocation();
// 'drum' is the relay role of a projector on its own device (split mode).
const client = new ShowClient({ role: 'drum', token: demo ? null : relayTokenForPage(), transport: demo ? new DemoTransport(demo) : undefined });
const stage = mountStage(root, { client });
client.start();

if (demo) document.title = `${document.title} · demo ${demo}`;
// Debugging: `window.quinaStage` (the scene on screen), and `?debug` logs every animation moment.
Object.assign(window, { quinaStage: stage });
if (new URLSearchParams(location.search).has('debug')) {
  root.addEventListener(ANIM_EVENT, (event) => console.debug('[stage]', (event as CustomEvent<AnimDetail>).detail));
}
