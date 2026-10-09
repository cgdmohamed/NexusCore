// Derived health of a project. The stored status is chosen by people and can disagree with the work,
// so lists show both: the status they set and what the tasks and dates say.

export type ProjectHealth =
  | "completed" | "archived" | "on_hold"          // follow the stored status
  | "ready_to_close"                              // active, every task is done
  | "overdue" | "at_risk" | "no_tasks" | "on_track";

export interface HealthInput {
  status: string;
  dueDate: Date | null;
  total: number;        // tasks excluding cancelled
  completed: number;
  overdueTasks: number; // open tasks past their own due date
  now?: Date;
}

const DAY = 24 * 60 * 60 * 1000;

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function projectHealth(p: HealthInput): ProjectHealth {
  if (p.status === "completed" || p.status === "archived" || p.status === "on_hold") return p.status;
  const today = startOfDay(p.now ?? new Date());
  const open = p.total - p.completed;

  if (p.total > 0 && open === 0) return "ready_to_close";
  if (p.dueDate && p.dueDate.getTime() < today.getTime()) return "overdue";
  if (p.overdueTasks > 0) return "at_risk";
  if (p.dueDate && p.total > 0) {
    const daysLeft = (p.dueDate.getTime() - today.getTime()) / DAY;
    const pct = p.completed / p.total;
    if (daysLeft <= 7 && pct < 0.7) return "at_risk";
  }
  if (p.total === 0) return "no_tasks";
  return "on_track";
}
