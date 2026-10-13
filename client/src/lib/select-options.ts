// Option lists for the searchable selects, built from the records the pages already load.
import type { SelectOption } from "@/components/ui/searchable-select";

const clean = (s: unknown) => (typeof s === "string" ? s.trim() : "");

export function personName(p: { firstName?: string | null; lastName?: string | null; employee?: { firstName?: string | null; lastName?: string | null } | null } | null | undefined): string {
  const own = [clean(p?.firstName), clean(p?.lastName)].filter(Boolean).join(" ");
  if (own) return own;
  return [clean(p?.employee?.firstName), clean(p?.employee?.lastName)].filter(Boolean).join(" ");
}

// People: the name when there is one, with the email underneath (both searchable)
export function userOptions(users: any[] | undefined | null): SelectOption[] {
  return (Array.isArray(users) ? users : []).map((u) => {
    const name = personName(u);
    const email = clean(u.email) || clean(u.username);
    return { value: String(u.id), label: name || email, description: name ? email : undefined, keywords: clean(u.username) };
  });
}

// Clients: archived ones are not offered for new records
export function clientOptions(clients: any[] | undefined | null): SelectOption[] {
  return (Array.isArray(clients) ? clients : [])
    .filter((c) => c.status !== "archived")
    .map((c) => ({ value: String(c.id), label: clean(c.name), description: clean(c.email) || clean(c.phone) || undefined, keywords: [clean(c.phone), clean(c.city)].filter(Boolean).join(" ") }));
}

export function projectOptions(projects: any[] | undefined | null): SelectOption[] {
  return (Array.isArray(projects) ? projects : []).map((p) => ({ value: String(p.id), label: clean(p.name) }));
}

export function listOptions(values: (string | null | undefined)[]): SelectOption[] {
  return values.filter((v): v is string => !!v).map((v) => ({ value: v, label: v }));
}
