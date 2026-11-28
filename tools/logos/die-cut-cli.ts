// The sticker step of tools/logos/prepare.py: packages/ui/components/die-cut.ts run on one logo, so the prepared
// stickers are exactly what the projector and the phones make from the same logo.
//   node tools/logos/die-cut-cli.ts <in.rgba> <width> <height> <out.rgba> [rim] [reach]
// In and out are raw RGBA bytes, row by row, straight alpha. `rim` and `reach` override DIE_CUT's (shares of the
// longer side). Prints the sticker's {width, height, logo, hull} as JSON.
import fs from 'node:fs';
import { dieCut } from '../../packages/ui/components/die-cut.ts';

const [input, width, height, output, rim, reach] = process.argv.slice(2);
if (!input || !width || !height || !output) {
  console.error('usage: node tools/logos/die-cut-cli.ts <in.rgba> <width> <height> <out.rgba>');
  process.exit(1);
}
const w = Number(width);
const h = Number(height);
const data = new Uint8ClampedArray(fs.readFileSync(input));
if (data.length !== w * h * 4) {
  console.error(`expected ${w * h * 4} bytes for ${w}×${h}, got ${data.length}`);
  process.exit(1);
}
const options = { ...(rim ? { rim: Number(rim) } : {}), ...(reach ? { reach: Number(reach) } : {}) };
const cut = dieCut({ width: w, height: h, data }, options);
fs.writeFileSync(output, cut.pixels.data);
console.log(JSON.stringify({ width: cut.pixels.width, height: cut.pixels.height, logo: cut.logo, hull: cut.hull }));
