// The model refers to records by id; the person confirming should see names. Looks the ids up for the waiting actions.
import { eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { clients, expenseCategories, projects, tasks, users } from "@shared/schema";
import { matchNames, type Named } from "../mcp/names";

type Kind = "task" | "client" | "project" | "user" | "category";
const SOURCES: Record<string, Kind> = {
  taskId: "task", clientId: "client", projectId: "project", assigneeId: "user", userId: "user", categoryId: "category",
};

// When the model gave a name instead of an id, the card shows the record that name will resolve to, not the words that were typed
const BY_NAME: Record<string, Exclude<Kind, "task">> = { clientName: "client", projectName: "project", assigneeName: "user", userName: "user", categoryName: "category" };

const fullName = (u: { firstName: string | null; lastName: string | null; username: string }) =>
  [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username;

// call id → { argument name → readable name }
export async function resolveNames(calls: { id: string; args: Record<string, unknown> }[]): Promise<Record<string, Record<string, string>>> {
  const wanted = { task: new Set<string>(), client: new Set<string>(), project: new Set<string>(), user: new Set<string>(), category: new Set<string>() };
  for (const c of calls) for (const [k, v] of Object.entries(c.args ?? {})) if (SOURCES[k] && typeof v === "string" && v) wanted[SOURCES[k]].add(v);

  const names = { task: new Map<string, string>(), client: new Map<string, string>(), project: new Map<string, string>(), user: new Map<string, string>(), category: new Map<string, string>() };
  try {
    if (wanted.task.size) for (const r of await db.select({ id: tasks.id, title: tasks.title }).from(tasks).where(inArray(tasks.id, Array.from(wanted.task)))) names.task.set(r.id, r.title);
    if (wanted.client.size) for (const r of await db.select({ id: clients.id, name: clients.name }).from(clients).where(inArray(clients.id, Array.from(wanted.client)))) names.client.set(r.id, r.name);
    if (wanted.project.size) for (const r of await db.select({ id: projects.id, name: projects.name }).from(projects).where(inArray(projects.id, Array.from(wanted.project)))) names.project.set(r.id, r.name);
    if (wanted.category.size) for (const r of await db.select({ id: expenseCategories.id, name: expenseCategories.name }).from(expenseCategories).where(inArray(expenseCategories.id, Array.from(wanted.category)))) names.category.set(r.id, r.name);
    if (wanted.user.size) for (const r of await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, username: users.username }).from(users).where(inArray(users.id, Array.from(wanted.user)))) names.user.set(r.id, fullName(r));
  } catch (error) {
    console.error("AI chat: could not look up names:", error); // the card still works, with ids
    return {};
  }

  const out: Record<string, Record<string, string>> = {};
  try {
    const pool: Partial<Record<Exclude<Kind, "task">, Named[]>> = {};
    const load = async (kind: Exclude<Kind, "task">): Promise<Named[]> => {
      if (pool[kind]) return pool[kind]!;
      if (kind === "client") pool[kind] = (await db.select({ id: clients.id, name: clients.name }).from(clients)).map((r) => ({ id: r.id, label: r.name, keys: [r.name] }));
      else if (kind === "category") pool[kind] = (await db.select({ id: expenseCategories.id, name: expenseCategories.name }).from(expenseCategories).where(eq(expenseCategories.isActive, true))).map((r) => ({ id: r.id, label: r.name, keys: [r.name] }));
      else if (kind === "project") pool[kind] = (await db.select({ id: projects.id, name: projects.name }).from(projects)).map((r) => ({ id: r.id, label: r.name, keys: [r.name] }));
      else pool[kind] = (await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, username: users.username, email: users.email }).from(users)).map((r) => ({ id: r.id, label: fullName(r), keys: [fullName(r), r.username, r.email ?? ""].filter(Boolean) }));
      return pool[kind]!;
    };
    for (const c of calls) {
      for (const [k, v] of Object.entries(c.args ?? {})) {
        const kind = BY_NAME[k];
        if (!kind || typeof v !== "string" || !v.trim()) continue;
        const m = matchNames(v, await load(kind));
        const group = m.exact.length ? m.exact : m.contains;
        if (group.length === 1) (out[c.id] ??= {})[k] = group[0].label;
      }
    }
  } catch (error) {
    console.error("AI chat: could not resolve names:", error);
  }
  for (const c of calls) {
    for (const [k, v] of Object.entries(c.args ?? {})) {
      const source = SOURCES[k];
      const name = source && typeof v === "string" ? names[source].get(v) : undefined;
      if (name) (out[c.id] ??= {})[k] = name;
    }
  }
  return out;
}
