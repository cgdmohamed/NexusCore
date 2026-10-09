// Dashboard figures derived from /api/tasks/stats and /api/employees, in one place so the
// dashboard cards cannot disagree with each other.

export interface TaskStatsLike {
  totalTasks?: number;
  overdueTasks?: number;
  statusBreakdown?: Record<string, number>;
}

const n = (v: number | undefined) => v ?? 0;

// Tasks still to be done (not finished, not cancelled)
export function openTasks(stats: TaskStatsLike | undefined): number {
  const b = stats?.statusBreakdown ?? {};
  return n(b.pending) + n(b.in_progress);
}

// Share of the tasks that count (cancelled ones are left out) that are done
export function completionRate(stats: TaskStatsLike | undefined): number {
  const b = stats?.statusBreakdown ?? {};
  const counted = n(stats?.totalTasks) - n(b.cancelled);
  return counted > 0 ? Math.round((n(b.completed) / counted) * 100) : 0;
}

// People who are still on the team: terminated and inactive employees are not counted, people on leave are
export function activeTeamSize(employees: Array<{ status?: string | null }> | undefined): number {
  return (employees ?? []).filter((e) => (e.status ?? "active") === "active" || e.status === "on_leave").length;
}
