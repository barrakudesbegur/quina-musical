// Lets a node test import a `.svelte.ts` module (runes: $state, $derived, $effect) as the browser build runs it:
// Node strips its types, Svelte compiles it for the client. Call it before importing such a module, with a dynamic
// `await import(…)`. Components still aren't mounted: this is for the state classes (Admin's PlanSession).
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import { compileModule } from 'svelte/compiler';

let registered = false;

export function registerSvelteModules(): void {
  if (registered) return;
  registered = true;
  registerHooks({
    load(url, context, nextLoad) {
      if (!url.startsWith('file:') || !url.endsWith('.svelte.ts')) return nextLoad(url, context);
      const file = fileURLToPath(url);
      const js = stripTypeScriptTypes(readFileSync(file, 'utf8'), { mode: 'strip' });
      return { format: 'module', source: compileModule(js, { filename: file, generate: 'client' }).js.code, shortCircuit: true };
    },
  });
}
