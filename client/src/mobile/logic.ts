// Pure helpers for the mobile screens: grouping, filtering and request payloads.
// Kept free of React so they can be unit tested.

export interface MobileTask {
  id: string;
  title: string;
  description: string | null;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  priority: "low" | "medium" | "high";
  dueDate: string | null;
  projectId: string | null;
  assignedTo: string | null;
  assigneeName: string | null;
  createdAt: string | null;
}

export type TaskGroupKey = "overdue" | "today" | "upcoming" | "no_date" | "done";
export type StatusFilter = "open" | "done" | "all";

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;

export const isOpen = (t: Pick<MobileTask, "status">) => t.status === "pending" || t.status === "in_progress";

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

const time = (v: string | null | undefined, fallback: number) => (v ? new Date(v).getTime() : fallback);

export function groupTasks(tasks: MobileTask[], now: Date = new Date(), filter: StatusFilter = "open") {
  const today = startOfDay(now).getTime();
  const tomorrow = today + 24 * 60 * 60 * 1000;
  const groups: Record<TaskGroupKey, MobileTask[]> = { overdue: [], today: [], upcoming: [], no_date: [], done: [] };

  for (const task of tasks) {
    if (task.status === "cancelled") continue;
    if (!isOpen(task)) {
      if (filter !== "open") groups.done.push(task);
      continue;
    }
    if (filter === "done") continue;
    const due = task.dueDate ? new Date(task.dueDate).getTime() : null;
    if (due === null) groups.no_date.push(task);
    else if (due < today) groups.overdue.push(task);
    else if (due < tomorrow) groups.today.push(task);
    else groups.upcoming.push(task);
  }

  const byPriority = (a: MobileTask, b: MobileTask) =>
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || time(b.createdAt, 0) - time(a.createdAt, 0);
  const byDue = (a: MobileTask, b: MobileTask) => time(a.dueDate, Infinity) - time(b.dueDate, Infinity) || byPriority(a, b);

  groups.overdue.sort(byDue);
  groups.today.sort(byPriority);
  groups.upcoming.sort(byDue);
  groups.no_date.sort(byPriority);
  groups.done.sort((a, b) => time(b.createdAt, 0) - time(a.createdAt, 0));

  const order: TaskGroupKey[] = ["overdue", "today", "upcoming", "no_date", "done"];
  return order.filter((key) => groups[key].length > 0).map((key) => ({ key, tasks: groups[key] }));
}

// ---- request payloads -------------------------------------------------------------------------

export type PayloadResult<T> = { ok: true; payload: T } | { ok: false; error: "name_required" | "title_required" | "bad_email" };

const clean = (v: string | null | undefined) => (v ?? "").trim();
const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export interface TaskInput { title: string; projectId?: string; dueDate?: string; priority?: MobileTask["priority"]; assignedTo?: string | null }

export function taskPayload(input: TaskInput): PayloadResult<Record<string, unknown>> {
  const title = clean(input.title);
  if (!title) return { ok: false, error: "title_required" };
  const payload: Record<string, unknown> = { title, priority: input.priority ?? "medium" };
  if (input.projectId) payload.projectId = input.projectId;
  if (input.dueDate) payload.dueDate = input.dueDate;
  if (input.assignedTo) payload.assignedTo = input.assignedTo;
  return { ok: true, payload };
}

export interface ProjectInput { name: string; clientId?: string; dueDate?: string }

export function projectPayload(input: ProjectInput): PayloadResult<Record<string, unknown>> {
  const name = clean(input.name);
  if (!name) return { ok: false, error: "name_required" };
  const payload: Record<string, unknown> = { name };
  if (input.clientId) payload.clientId = input.clientId;
  if (input.dueDate) payload.dueDate = input.dueDate;
  return { ok: true, payload };
}

export interface ClientInput { name: string; phone?: string; email?: string }

export function clientPayload(input: ClientInput): PayloadResult<Record<string, unknown>> {
  const name = clean(input.name);
  if (!name) return { ok: false, error: "name_required" };
  const email = clean(input.email);
  if (email && !looksLikeEmail(email)) return { ok: false, error: "bad_email" };
  const payload: Record<string, unknown> = { name };
  const phone = clean(input.phone);
  if (phone) payload.phone = phone;
  if (email) payload.email = email;
  return { ok: true, payload };
}

// Digits only, with Egypt's country code when the number starts with the local 0
export function whatsappLink(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, "");
  if (!digits) return null;
  const international = digits.startsWith("+") ? digits.slice(1) : digits.startsWith("00") ? digits.slice(2) : digits.startsWith("0") ? `20${digits.slice(1)}` : digits;
  return /^\d{8,15}$/.test(international) ? `https://wa.me/${international}` : null;
}
