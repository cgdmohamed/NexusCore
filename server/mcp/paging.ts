// A list that says how much there is, so nobody mistakes the first page for everything
export const DEFAULT_PAGE = 50;

export interface Page<T> { total: number; returned: number; offset: number; hasMore: boolean; items: T[] }

export function pageOf<T>(total: number, items: T[], offset = 0): Page<T> {
  return { total, returned: items.length, offset, hasMore: offset + items.length < total, items };
}

export const pageProps = {
  limit: { type: "integer", minimum: 1, maximum: 100, description: `How many to return (default ${DEFAULT_PAGE})` },
  offset: { type: "integer", minimum: 0, description: "Skip this many first, to read the next page when hasMore is true" },
} as const;
