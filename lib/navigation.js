/** Prefer the deepest matching destination, including nested administration pages. */
export function getActiveNavigationItem(pathname, items) {
  return items.reduce((best, item) => {
    if (pathname !== item.href && !pathname.startsWith(`${item.href}/`)) return best;
    return !best || item.href.length > best.href.length ? item : best;
  }, null);
}
