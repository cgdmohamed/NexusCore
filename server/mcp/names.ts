// Matching a name a person (or a model) typed against the names in the database.
// "rose gold", "Rose-Gold" and "rosegold" are the same name; so are "أحمد" and "احمد", "مدرسة" and "مدرسه".

const MARKS = /[ً-ْٰـ]/g; // Arabic vowel marks and tatweel
const SEPARATORS = /[\s\-_.,،;:/\\()[\]{}'"’`|+&]+/g;

export function normalizeName(text: string): string {
  return text
    .toLowerCase()
    .replace(MARKS, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(SEPARATORS, "");
}

/** Edit distance between two short strings (insert, delete, replace), enough to catch a slip of the keyboard */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

export interface Named { id: string; label: string; /** every spelling the record answers to: its name, a username, an email */ keys: string[] }
export interface NameMatches { exact: Named[]; contains: Named[]; suggestions: Named[] }

/** Records the text names: exactly, by containing it, and (only when nothing else fits) the closest spellings to offer back */
export function matchNames(text: string, rows: Named[]): NameMatches {
  const q = normalizeName(text);
  const exact: Named[] = [];
  const contains: Named[] = [];
  if (!q) return { exact, contains, suggestions: [] };
  const normalized = rows.map((r) => ({ r, keys: r.keys.map(normalizeName).filter(Boolean) }));
  for (const { r, keys } of normalized) {
    if (keys.some((k) => k === q)) exact.push(r);
    else if (keys.some((k) => k.includes(q))) contains.push(r);
  }
  let suggestions: Named[] = [];
  if (exact.length === 0 && contains.length === 0) {
    const allowed = Math.max(1, Math.floor(q.length / 4));
    suggestions = normalized
      .map(({ r, keys }) => ({ r, d: Math.min(...keys.map((k) => editDistance(q, k)), Infinity) }))
      .filter((x) => x.d <= allowed)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3)
      .map((x) => x.r);
  }
  return { exact, contains, suggestions };
}

/** The one record a name stands for, or what to tell the model so it can choose: several candidates, a "did you mean", or nothing */
export function pickByName(text: string, rows: Named[], kind: string, hints: { none: string; singular?: string }): { picked: Named } | { error: string } {
  const m = matchNames(text, rows);
  const one = hints.singular ?? kind.replace(/s$/, "");
  const list = (items: Named[]) => items.slice(0, 10).map((r) => `${r.label} (${r.id})`).join("; ");
  const group = m.exact.length > 0 ? m.exact : m.contains;
  if (group.length === 1) return { picked: group[0] };
  if (group.length > 1) return { error: `"${text}" matches ${group.length} ${kind}: ${list(group)}. Repeat with the id of the right one.` };
  if (m.suggestions.length > 0) return { error: `No ${one} is named "${text}". Did you mean: ${list(m.suggestions)}? Repeat with the id if one of them is right.` };
  return { error: `No ${one} matches "${text}". ${hints.none}` };
}

/** Ids of the records whose names contain the text, for a search box that should not care about spaces or hamzas */
export function nameSearchIds(text: string, rows: Named[]): string[] {
  const m = matchNames(text, rows);
  return [...m.exact, ...m.contains].map((r) => r.id);
}
