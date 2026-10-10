import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useTranslation } from "@/lib/i18n";
import type { ProjectRow } from "@/components/projects/ProjectCard";
import { BottomSheet, Field, Segmented, dateInputCls, inputCls } from "./ui";
import { refreshLists, useOnline } from "./hooks";
import type { MobileTask } from "./logic";

export function useTaskUpdate() {
  const { t } = useTranslation();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: Record<string, unknown> }) =>
      (await apiRequest("PUT", `/api/tasks/${id}`, changes)).json(),
    onSuccess: () => refreshLists(),
    onError: (e: Error) => toast({ title: t("m.save_failed"), description: e.message, variant: "destructive" }),
  });
}

export function TaskSheet({ task, projects, onClose }: { task: MobileTask | null; projects: ProjectRow[]; onClose: () => void }) {
  const { t } = useTranslation();
  const { canEdit } = usePermissions();
  const online = useOnline();
  const update = useTaskUpdate();
  const [due, setDue] = useState("");
  const editable = canEdit("tasks") && online;

  useEffect(() => {
    setDue(task?.dueDate ? task.dueDate.slice(0, 10) : "");
  }, [task?.id, task?.dueDate]);

  const change = (changes: Record<string, unknown>) => task && update.mutate({ id: task.id, changes });
  const project = projects.find((p) => p.id === task?.projectId);

  return (
    <BottomSheet open={!!task} onOpenChange={(o) => { if (!o) onClose(); }} title={task?.title ?? ""}>
      {task && (
        <div className="space-y-4">
          {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}
          <Field label={t("m.status")}>
            <Segmented
              disabled={!editable || update.isPending}
              value={task.status === "cancelled" ? "pending" : task.status}
              onChange={(status) => change({ status })}
              options={[
                { value: "pending", label: t("m.status_pending") },
                { value: "in_progress", label: t("m.status_in_progress") },
                { value: "completed", label: t("m.status_completed") },
              ]}
            />
          </Field>
          <Field label={t("m.priority")}>
            <Segmented
              disabled={!editable || update.isPending}
              value={task.priority}
              onChange={(priority) => change({ priority })}
              options={[
                { value: "low", label: t("m.priority_low") },
                { value: "medium", label: t("m.priority_medium") },
                { value: "high", label: t("m.priority_high") },
              ]}
            />
          </Field>
          <Field label={t("m.due_date")}>
            <input
              type="date"
              value={due}
              disabled={!editable}
              onChange={(e) => {
                setDue(e.target.value);
                if (e.target.value) change({ dueDate: e.target.value });
              }}
              className={dateInputCls}
            />
          </Field>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">{t("m.project")}</dt>
              <dd className="font-medium">{project?.name ?? t("m.none")}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("m.assignee")}</dt>
              <dd className="font-medium">{task.assigneeName ?? t("m.unassigned")}</dd>
            </div>
          </dl>
        </div>
      )}
    </BottomSheet>
  );
}
