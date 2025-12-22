export function urlWithParams(
  url: URL | string,
  params: Record<
    string,
    number[] | string[] | number | string | null | undefined
  >,
  { clearExisting }: { clearExisting?: boolean } = { clearExisting: false }
) {
  const urlObj = new URL(url);
  if (clearExisting) {
    const keysToDelete = Array.from(urlObj.searchParams.keys());
    keysToDelete.forEach((key) => {
      urlObj.searchParams.delete(key);
    });
  }
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((v) => {
        urlObj.searchParams.append(key, String(v));
      });
    } else if (value === null || value === undefined) {
      urlObj.searchParams.delete(key);
    } else {
      urlObj.searchParams.set(key, String(value));
    }
  });
  return urlObj.toString();
}
