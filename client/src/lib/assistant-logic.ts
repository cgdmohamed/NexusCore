// Pure helpers for the assistant screen: how an action waiting for confirmation is described to the person.

export interface PendingAction { id: string; name: string; title: string; args: Record<string, any>; names?: Record<string, string> }

export interface ActionLine { label: string; qty: number; price: number; discount?: number }
export interface ActionSummary {
  fields: { key: string; value: string }[];
  lines: ActionLine[];
  // An estimate for quotations and invoices; the server's figure is the one that is saved
  total: number | null;
}

const WRITE_PREFIXES = ["create_", "assign_", "update_", "add_"];
export const isWriteTool = (name: string) => WRITE_PREFIXES.some((p) => name.startsWith(p));

const HIDDEN = new Set(["items", "allowDuplicate"]);
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function describeAction(action: PendingAction): ActionSummary {
  const a = action.args ?? {};
  const fields = Object.entries(a)
    .filter(([k, v]) => !HIDDEN.has(k) && v !== undefined && v !== null && v !== "")
    .map(([key, v]) => ({ key, value: typeof v === "object" ? JSON.stringify(v) : String(v) }));

  const rawItems = Array.isArray(a.items) ? a.items : [];
  const lines: ActionLine[] = rawItems.map((i: any) => ({
    label: String(i.name ?? i.description ?? ""), qty: Number(i.quantity) || 0, price: Number(i.unitPrice) || 0,
    ...(i.discountPercent ? { discount: Number(i.discountPercent) } : {}),
  }));

  let total: number | null = null;
  if (lines.length && (action.name === "create_invoice" || action.name === "create_quotation")) {
    const sum = lines.reduce((s, l) => s + (l.qty * l.price) * (1 - (l.discount ?? 0) / 100), 0);
    const tax = action.name === "create_invoice" ? Number(a.taxRate) || 0 : 0;
    const disc = action.name === "create_invoice" ? Number(a.discountRate) || 0 : 0;
    total = round2(sum + (sum * tax) / 100 - (sum * disc) / 100);
  }
  return { fields, lines, total };
}

// Which quick prompts to offer, from what the person may do
export function suggestionKeys(can: { view: (m: string) => boolean; add: (m: string) => boolean }): string[] {
  const out: string[] = [];
  if (can.view("tasks")) out.push("overdue");
  if (can.add("tasks")) out.push("task");
  if (can.add("crm")) out.push("client");
  if (can.add("invoices")) out.push("invoice");
  if (can.add("quotations")) out.push("quotation");
  return out.slice(0, 4);
}

// Several changes to one task read as one line: the model often sends a separate call for each field
const MERGE_BY: Record<string, string> = { update_task: "taskId", assign_task: "taskId" };

export interface ActionGroup { name: string; title: string; rows: PendingAction[] }

export function groupActions(actions: PendingAction[]): ActionGroup[] {
  const groups: ActionGroup[] = [];
  for (const a of actions) {
    let group = groups.find((g) => g.name === a.name);
    if (!group) { group = { name: a.name, title: a.title, rows: [] }; groups.push(group); }
    const key = MERGE_BY[a.name];
    const same = key ? group.rows.find((r) => r.args[key] && r.args[key] === a.args[key]) : undefined;
    if (same) { same.args = { ...same.args, ...a.args }; same.names = { ...same.names, ...a.names }; }
    else group.rows.push({ ...a, args: { ...a.args }, names: { ...a.names } });
  }
  return groups;
}

// The fields of one row without the id that names its subject; ids that were looked up show as names
export function changeFields(action: PendingAction): { key: string; value: string }[] {
  const subjectKey = MERGE_BY[action.name];
  return Object.entries(action.args ?? {})
    .filter(([k, v]) => k !== subjectKey && !HIDDEN.has(k) && v !== undefined && v !== null && v !== "")
    .map(([key, v]) => ({ key, value: action.names?.[key] ?? (typeof v === "object" ? JSON.stringify(v) : String(v)) }));
}

export const subjectOf = (action: PendingAction): string | null => {
  const key = MERGE_BY[action.name];
  return key ? action.names?.[key] ?? null : null;
};

// The same step repeated (four task updates) is shown once, with a count
export interface EventChip { name: string; ok: boolean; count: number; link?: string }
export function collapseEvents<T extends { role: string; name?: string; ok?: boolean; link?: string }>(items: T[]): (T | (T & { count: number }))[] {
  const out: any[] = [];
  for (const item of items) {
    const prev = out[out.length - 1];
    if (item.role === "event" && prev?.role === "event" && prev.name === item.name && prev.ok === item.ok && !item.link && !prev.link) prev.count += 1;
    else out.push(item.role === "event" ? { ...item, count: 1 } : item);
  }
  return out;
}
