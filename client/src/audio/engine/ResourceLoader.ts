import { Emitter, Resource } from './types';

type Events = { progress: { loaded: number; total: number } };

export class ResourceLoader<T extends string | number> extends Emitter<Events> {
  private urls = new Map<T, string>();
  private loading = new Set<T>();
  private abortCtrl: AbortController | null = null;

  get(id: T) {
    return this.urls.get(id);
  }

  get loadedCount() {
    return this.urls.size;
  }

  async loadAll(resources: Resource<T>[], concurrency = 4) {
    const toLoad = resources.filter(({ id }) => !this.urls.has(id));
    if (!toLoad.length) return;

    this.abortCtrl?.abort();
    this.abortCtrl = new AbortController();
    const { signal } = this.abortCtrl;

    const queue = [...toLoad];
    let loaded = this.urls.size;
    const total = loaded + queue.length;

    const work = async () => {
      while (queue.length) {
        const item = queue.shift()!;
        if (this.urls.has(item.id) || this.loading.has(item.id)) continue;

        this.loading.add(item.id);
        try {
          const res = await fetch(item.url, { cache: 'force-cache', signal });
          if (res.ok) {
            this.urls.set(item.id, URL.createObjectURL(await res.blob()));
            this.emit('progress', { loaded: ++loaded, total });
          }
        } catch {
          /* ignore */
        } finally {
          this.loading.delete(item.id);
        }
      }
    };

    await Promise.all(Array.from({ length: concurrency }, work));
  }

  destroy() {
    this.abortCtrl?.abort();
    this.urls.forEach((url) => URL.revokeObjectURL(url));
    this.urls.clear();
  }
}
