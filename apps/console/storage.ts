// This device's localStorage, made safe: private windows and blocked storage read as empty and ignore
// writes, never throw. Only per-device conveniences live here (label, theme, checklist); the show's state
// always comes from the engine.

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function readStored(key: string): string | null {
  try {
    return storage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string | null): void {
  try {
    const s = storage();
    if (!s) return;
    if (value === null) s.removeItem(key);
    else s.setItem(key, value);
  } catch {
    // Storage full or blocked: the setting lasts until the page reloads.
  }
}
