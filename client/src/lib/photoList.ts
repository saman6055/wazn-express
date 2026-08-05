/**
 * Turning whatever a row happens to carry into a list of pictures to show.
 *
 * The photo fields in this system arrive in every shape: a JSON array of
 * warehouse shots, a single `productImage` column, a `productImages` array,
 * and often two of those at once for the same parcel. A thumbnail that says
 * "3" has to mean three different pictures, so the same URL reaching it twice
 * — the product image that is also the first item of productImages — must
 * count once.
 */
export function dedupePhotos(...sources: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const take = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(take);
      return;
    }
    if (typeof value !== "string") return;
    const url = value.trim();
    if (!url || seen.has(url)) return;
    seen.add(url);
    out.push(url);
  };

  sources.forEach(take);
  return out;
}
