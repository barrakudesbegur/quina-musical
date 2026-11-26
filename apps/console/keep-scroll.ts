// A long list keeps its place (the Consola-Pestanyes-Noves board: «guarda on éreu quan canvieu de pestanya»): only
// the selected tab is drawn, so a list is rebuilt each time its tab opens. This attachment puts it back where it was
// and notes every scroll in `store`, under the list's name.
import type { Attachment } from 'svelte/attachments';

export function keepScroll(store: Map<string, number>, key: string): Attachment<HTMLElement> {
  return (node) => {
    node.scrollTop = store.get(key) ?? 0;
    const save = () => store.set(key, node.scrollTop);
    node.addEventListener('scroll', save, { passive: true });
    return () => node.removeEventListener('scroll', save);
  };
}
