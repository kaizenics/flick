// A design doc is `{ pages: FabricJSON[] }`. Designs saved before multi-page hold one bare Fabric JSON.
export function pagesFromDoc(doc: unknown): Record<string, unknown>[] {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return [];
  const d = doc as Record<string, unknown>;
  if (Array.isArray(d.pages)) return d.pages.filter((p): p is Record<string, unknown> => !!p && typeof p === "object");
  return Array.isArray(d.objects) ? [d] : [];
}
