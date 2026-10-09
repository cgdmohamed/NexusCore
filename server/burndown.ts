// Burndown series for one project: open tasks remaining each day against the straight line to the due date.
// Pure and clock-free so the shape can be tested without a database.

import { APP_TIMEZONE, dayKey } from "./task-insights";

export interface BurndownTask {
  createdAt: Date | null;
  completedDate: Date | null;
  status: string;
}

export interface BurndownPoint {
  date: string;
  ideal: number;
  // null for days that have not happened yet
  remaining: number | null;
}

export interface Burndown {
  startDate: string;
  dueDate: string;
  today: string;
  total: number;
  remaining: number;
  daysLeft: number;
  // Open tasks minus what the straight line expected by today: positive means behind plan
  behindBy: number;
  points: BurndownPoint[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
// Longer projects are shown over their final stretch so the chart stays readable on a phone
export const MAX_DAYS = 45;

const toMs = (day: string) => Date.parse(`${day}T12:00:00Z`);
const addDays = (day: string, n: number) => new Date(toMs(day) + n * DAY_MS).toISOString().slice(0, 10);
const diffDays = (a: string, b: string) => Math.round((toMs(b) - toMs(a)) / DAY_MS);

export function buildBurndown(
  input: { tasks: BurndownTask[]; startDate: Date; dueDate: Date },
  now: Date = new Date(),
  tz: string = APP_TIMEZONE,
): Burndown | null {
  // Cancelled work was never going to burn down
  const tasks = input.tasks.filter((t) => t.status !== "cancelled");
  if (tasks.length === 0) return null;

  const today = dayKey(now, tz);
  // Due dates are stored as the UTC midnight of the calendar day, so they are read in UTC
  const dueDay = input.dueDate.toISOString().slice(0, 10);
  let startDay = dayKey(input.startDate, tz);
  if (startDay > dueDay) startDay = dueDay;
  if (diffDays(startDay, dueDay) > MAX_DAYS - 1) startDay = addDays(dueDay, -(MAX_DAYS - 1));

  // A project that is already late keeps drawing until today so the overrun is visible
  const lastDay = today > dueDay ? today : dueDay;
  const span = Math.min(diffDays(startDay, lastDay), MAX_DAYS * 2);

  const created = tasks.map((t) => (t.createdAt ? dayKey(t.createdAt, tz) : startDay));
  const finished = tasks.map((t) => (t.status === "completed" ? (t.completedDate ? dayKey(t.completedDate, tz) : (t.createdAt ? dayKey(t.createdAt, tz) : startDay)) : null));

  const remainingOn = (day: string) => {
    let open = 0;
    for (let i = 0; i < tasks.length; i++) {
      if (created[i] <= day && !(finished[i] && finished[i]! <= day)) open++;
    }
    return open;
  };

  // The plan starts from the work that existed on day one; a project with no tasks yet plans for what it has now
  const initial = Math.max(remainingOn(startDay), 1);
  const planDays = Math.max(diffDays(startDay, dueDay), 1);

  const points: BurndownPoint[] = [];
  for (let i = 0; i <= span; i++) {
    const date = addDays(startDay, i);
    const ideal = Math.max(0, Math.round(initial * (1 - i / planDays) * 100) / 100);
    points.push({ date, ideal, remaining: date <= today ? remainingOn(date) : null });
  }

  const current = remainingOn(today);
  const todayPoint = points.find((p) => p.date === today);
  const expected = todayPoint ? todayPoint.ideal : today < startDay ? initial : 0;

  return {
    startDate: startDay,
    dueDate: dueDay,
    today,
    total: tasks.length,
    remaining: current,
    daysLeft: diffDays(today, dueDay),
    behindBy: Math.round((current - expected) * 10) / 10,
    points,
  };
}
