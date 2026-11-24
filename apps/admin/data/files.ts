// Getting text in and out of the page: download a file, copy to the clipboard, read an uploaded file.
// Each reports failure instead of throwing, so the page can offer the manual way.

/** Download `text` as a file. False if the browser refused. */
export function downloadText(fileName: string, text: string, type = 'application/json'): boolean {
  try {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Copy `text`. The Clipboard API needs a secure context, which the LAN console page is not, so it falls back
 * to a hidden textarea and the old copy command. False when both fail (the page then shows the text to copy
 * by hand).
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (window.isSecureContext && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the fallback.
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    // Deprecated, but the only way without a secure context.
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/** An uploaded file's text, or null when it can't be read. */
export async function readFileText(file: Blob): Promise<string | null> {
  try {
    return await file.text();
  } catch {
    return null;
  }
}
