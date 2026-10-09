import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckSquare, FolderKanban, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useTranslation } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import type { ProjectRow } from "@/components/projects/ProjectCard";
import { BottomSheet, Field, Segmented, inputCls } from "./ui";
import { useList, useOnline, refreshLists } from "./hooks";
import { clientPayload, projectPayload, taskPayload, type MobileTask } from "./logic";

export type AddKind = "task" | "project" | "client";
export interface AddRequest { kind?: AddKind; projectId?: string; clientId?: string }

interface Props { open: boolean; onOpenChange: (o: boolean) => void; request: AddRequest }

export function QuickAdd({ open, onOpenChange, request }: Props) {
  const { t } = useTranslation();
  const { canAdd } = usePermissions();
  const [kind, setKind] = useState<AddKind | null>(null);

  // Opening from a project or client card jumps straight to the form
  useEffect(() => {
    if (open) setKind(request.kind ?? null);
  }, [open, request.kind]);

  const options: { kind: AddKind; icon: typeof CheckSquare; label: string; hint: string; allowed: boolean }[] = [
    { kind: "task", icon: CheckSquare, label: t("m.add_task"), hint: t("m.add_task_hint"), allowed: canAdd("tasks") },
    { kind: "project", icon: FolderKanban, label: t("m.add_project"), hint: t("m.add_project_hint"), allowed: canAdd("projects") },
    { kind: "client", icon: Users, label: t("m.add_client"), hint: t("m.add_client_hint"), allowed: canAdd("crm") },
  ];
  const title = kind === "task" ? t("m.new_task") : kind === "project" ? t("m.new_project") : kind === "client" ? t("m.new_client") : t("m.add_title");

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={title}>
      {kind === null ? (
        <ul className="space-y-2">
          {options.filter((o) => o.allowed).map((o) => (
            <li key={o.kind}>
              <button onClick={() => setKind(o.kind)} className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-start active:bg-accent">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent text-primary"><o.icon className="h-5 w-5" /></span>
                <span className="flex-1">
                  <span className="block font-medium text-foreground">{o.label}</span>
                  <span className="block text-sm text-muted-foreground">{o.hint}</span>
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground rtl:-scale-x-100" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div>
          {!request.kind && (
            <button onClick={() => setKind(null)} className="-mt-1 mb-3 flex h-9 items-center gap-1 text-sm text-muted-foreground">
              <ChevronLeft className="h-4 w-4 rtl:-scale-x-100" />
              {t("m.back")}
            </button>
          )}
          {kind === "task" && <TaskForm request={request} onDone={() => onOpenChange(false)} />}
          {kind === "project" && <ProjectForm request={request} onDone={() => onOpenChange(false)} />}
          {kind === "client" && <ClientForm onDone={() => onOpenChange(false)} />}
        </div>
      )}
    </BottomSheet>
  );
}

function useCreate(path: string, savedKey: string) {
  const { t } = useTranslation();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => (await apiRequest("POST", path, payload)).json(),
    onSuccess: async () => {
      await refreshLists();
      toast({ title: t(savedKey) });
    },
    onError: (e: Error) => toast({ title: t("m.save_failed"), description: e.message, variant: "destructive" }),
  });
}

function SaveBar({ pending, onSaveAnother }: { pending: boolean; onSaveAnother: () => void }) {
  const { t } = useTranslation();
  const online = useOnline();
  return (
    <div className="mt-5 space-y-2">
      <Button type="submit" className="h-12 w-full text-base" disabled={pending || !online}>
        {pending ? t("m.saving") : t("m.save")}
      </Button>
      <Button type="button" variant="ghost" className="h-11 w-full" disabled={pending || !online} onClick={onSaveAnother}>
        {t("m.save_another")}
      </Button>
    </div>
  );
}

// Shared submit flow: validate, send, then either close or clear the form for the next one
function useSubmit<T>(build: () => { ok: true; payload: Record<string, unknown> } | { ok: false; error: string }, create: ReturnType<typeof useCreate>, reset: () => void, onDone: () => void, setError: (e: string | null) => void) {
  const { t } = useTranslation();
  return (another: boolean) => {
    const result = build();
    if (!result.ok) {
      setError(t(result.error === "title_required" ? "m.err_title" : result.error === "bad_email" ? "m.err_email" : "m.err_name"));
      return;
    }
    setError(null);
    create.mutate(result.payload, {
      onSuccess: () => {
        if (another) reset();
        else onDone();
      },
    });
  };
}

function TaskForm({ request, onDone }: { request: AddRequest; onDone: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: projects = [] } = useList<ProjectRow[]>("/api/projects");
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState(request.projectId ?? "");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<MobileTask["priority"]>("medium");
  const [mine, setMine] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const create = useCreate("/api/tasks", "m.saved_task");
  const submit = useSubmit(
    () => taskPayload({ title, projectId, dueDate, priority, assignedTo: mine ? user?.id : null }),
    create, () => { setTitle(""); }, onDone, setError,
  );
  const live = projects.filter((p) => p.status === "active" || p.status === "on_hold" || p.id === projectId);

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(false); }} className="space-y-4">
      <Field label={t("m.title")} error={error}>
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("m.title_ph")} className={inputCls} enterKeyHint="done" />
      </Field>
      <Field label={t("m.due_date")}>
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
      </Field>
      <Field label={t("m.priority")}>
        <Segmented value={priority} onChange={setPriority} options={[
          { value: "low", label: t("m.priority_low") }, { value: "medium", label: t("m.priority_medium") }, { value: "high", label: t("m.priority_high") },
        ]} />
      </Field>
      <Field label={t("m.project")}>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputCls}>
          <option value="">{t("m.none")}</option>
          {live.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <label className="flex h-11 items-center gap-3 text-base">
        <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="h-5 w-5 accent-[hsl(var(--primary))]" />
        {t("m.assign_me")}
      </label>
      <SaveBar pending={create.isPending} onSaveAnother={() => submit(true)} />
    </form>
  );
}

function ProjectForm({ request, onDone }: { request: AddRequest; onDone: () => void }) {
  const { t } = useTranslation();
  const { data: clients = [] } = useList<any[]>("/api/clients?excludeArchived=true");
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState(request.clientId ?? "");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const create = useCreate("/api/projects", "m.saved_project");
  const submit = useSubmit(() => projectPayload({ name, clientId, dueDate }), create, () => setName(""), onDone, setError);

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(false); }} className="space-y-4">
      <Field label={t("m.name")} error={error}>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className={inputCls} enterKeyHint="done" />
      </Field>
      <Field label={t("m.client")}>
        <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputCls}>
          <option value="">{t("m.none")}</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label={t("m.due_date")}>
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
      </Field>
      <SaveBar pending={create.isPending} onSaveAnother={() => submit(true)} />
    </form>
  );
}

function ClientForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const create = useCreate("/api/clients", "m.saved_client");
  const submit = useSubmit(() => clientPayload({ name, phone, email }), create, () => { setName(""); setPhone(""); setEmail(""); }, onDone, setError);

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(false); }} className="space-y-4">
      <Field label={t("m.name")} error={error}>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className={inputCls} autoComplete="off" />
      </Field>
      <Field label={t("m.phone")}>
        <input type="tel" inputMode="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} className={`${inputCls} text-start`} autoComplete="off" />
      </Field>
      <Field label={t("m.email")}>
        <input type="email" inputMode="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputCls} text-start`} autoComplete="off" autoCapitalize="none" />
      </Field>
      <SaveBar pending={create.isPending} onSaveAnother={() => submit(true)} />
    </form>
  );
}
