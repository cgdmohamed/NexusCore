import { useState } from "react";
import { cn } from "@/lib/utils";

// Small SVG charts in the app's own colours. Time runs left to right in both languages so
// numbers and dates read the same way; every chart also carries a text equivalent for screen readers.

export interface Column { label: string; value: number; detail: string }

const W = 320;
const H = 132;
const PAD_TOP = 20;
const PAD_BOTTOM = 20;

// A bar whose top corners are rounded and whose foot sits flat on the baseline
function barPath(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

export function ColumnChart({ data, average, averageLabel, ariaLabel }: { data: Column[]; average: number; averageLabel: string; ariaLabel: string }) {
  const [picked, setPicked] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value), Math.ceil(average));
  const plotH = H - PAD_TOP - PAD_BOTTOM;
  const slot = W / data.length;
  const barW = Math.max(6, Math.min(26, slot - 6));
  const labelEvery = data.length <= 7 ? 1 : data.length <= 14 ? 2 : 5;
  const y = (v: number) => PAD_TOP + plotH - (v / max) * plotH;
  const baseline = PAD_TOP + plotH;
  const selected = picked !== null ? data[picked] : null;

  return (
    <div dir="ltr">
      <div className="mb-1 flex h-5 items-center justify-between text-xs text-muted-foreground">
        <span className="tabular-nums">{selected ? selected.detail : " "}</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0 w-4 border-t-2 border-dashed border-muted-foreground" aria-hidden />
          {averageLabel}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={ariaLabel}>
        <line x1="0" x2={W} y1={baseline} y2={baseline} className="stroke-border" strokeWidth="1" />
        {average > 0 && (
          <line x1="0" x2={W} y1={y(average)} y2={y(average)} className="stroke-muted-foreground" strokeWidth="1.5" strokeDasharray="4 4" />
        )}
        {data.map((d, i) => {
          const h = Math.max(d.value > 0 ? 3 : 0, (d.value / max) * plotH);
          const x = i * slot + (slot - barW) / 2;
          const active = picked === i;
          return (
            <g key={i}>
              {/* A wider invisible target so a thumb can hit a thin bar */}
              <rect x={i * slot} y={0} width={slot} height={H} fill="transparent" onClick={() => setPicked(active ? null : i)} className="cursor-pointer" />
              {d.value > 0 && <path d={barPath(x, baseline - h, barW, h, 4)} className={cn("transition-opacity", active || picked === null ? "fill-primary" : "fill-primary/40")} />}
              {d.value > 0 && slot >= 18 && (
                <text x={x + barW / 2} y={baseline - h - 4} textAnchor="middle" className="fill-foreground text-[10px] tabular-nums">{d.value}</text>
              )}
              {i % labelEvery === 0 && (
                <text x={i * slot + slot / 2} y={H - 5} textAnchor="middle" className={cn("text-[10px]", active ? "fill-foreground font-semibold" : "fill-muted-foreground")}>{d.label}</text>
              )}
            </g>
          );
        })}
      </svg>
      <table className="sr-only">
        <tbody>
          {data.map((d, i) => (
            <tr key={i}><th scope="row">{d.detail}</th></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Sparkline({ values, ariaLabel }: { values: number[]; ariaLabel: string }) {
  const w = 120;
  const h = 36;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(h - 3 - (v / max) * (h - 8)).toFixed(1)}`);
  const last = pts[pts.length - 1]?.split(",");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-9 w-28" role="img" aria-label={ariaLabel} style={{ direction: "ltr" }}>
      <polyline points={pts.join(" ")} fill="none" className="stroke-primary" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {last && <circle cx={last[0]} cy={last[1]} r="3" className="fill-primary stroke-card" strokeWidth="2" />}
    </svg>
  );
}

export interface Segment { label: string; value: number; className: string }

// Part of a whole as one bar: counts sit in the legend, so no number is colour-only
export function StackedBar({ segments, ariaLabel }: { segments: Segment[]; ariaLabel: string }) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  return (
    <div>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={ariaLabel}>
        {total > 0 && segments.filter((s) => s.value > 0).map((s) => (
          <span key={s.label} className={cn("h-full first:rounded-s-full last:rounded-e-full", s.className)} style={{ width: `${(s.value / total) * 100}%` }} />
        ))}
      </div>
      <ul className="mt-2 grid grid-cols-3 gap-2 text-xs">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-1.5 text-muted-foreground">
            <span className={cn("h-2.5 w-2.5 shrink-0 rounded-sm", s.className)} aria-hidden />
            <span className="truncate">{s.label}</span>
            <span className="ms-auto font-medium text-foreground tabular-nums">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HBars({ rows, ariaLabel }: { rows: Array<{ label: string; value: number }>; ariaLabel: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2" aria-label={ariaLabel}>
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-3 text-sm">
          <span className="w-24 shrink-0 truncate text-muted-foreground">{r.label}</span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="w-6 text-end font-medium tabular-nums">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

export interface BurndownDatum { label: string; ideal: number; remaining: number | null }

// Open tasks left each day (solid) against the straight line to the due date (dashed).
// The last real reading carries a direct label; tapping a day reads its exact values.
export function Burndown({ data, todayIndex, idealLabel, actualLabel, ariaLabel, describe }: {
  data: BurndownDatum[];
  todayIndex: number;
  idealLabel: string;
  actualLabel: string;
  ariaLabel: string;
  describe: (d: BurndownDatum) => string;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const PAD_X = 14;
  const max = Math.max(1, ...data.map((d) => Math.max(d.ideal, d.remaining ?? 0)));
  const plotH = H - PAD_TOP - PAD_BOTTOM;
  const plotW = W - PAD_X * 2;
  const x = (i: number) => PAD_X + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const y = (v: number) => PAD_TOP + plotH - (v / max) * plotH;
  const baseline = PAD_TOP + plotH;
  const idealPath = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.ideal).toFixed(1)}`).join(" ");
  const actual = data.map((d, i) => ({ d, i })).filter(({ d }) => d.remaining !== null);
  const actualPath = actual.map(({ d, i }, k) => `${k === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.remaining!).toFixed(1)}`).join(" ");
  const last = actual[actual.length - 1];
  const selected = picked !== null ? data[picked] : null;
  const labelEvery = Math.max(1, Math.ceil(data.length / 5));

  return (
    <div dir="ltr">
      <div className="mb-1 flex min-h-5 items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="tabular-nums">{selected ? describe(selected) : " "}</span>
        <span className="flex shrink-0 items-center gap-3">
          <span className="flex items-center gap-1.5"><span className="inline-block h-0 w-4 border-t-2 border-primary" aria-hidden />{actualLabel}</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-0 w-4 border-t-2 border-dashed border-muted-foreground" aria-hidden />{idealLabel}</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={ariaLabel}>
        <line x1="0" x2={W} y1={baseline} y2={baseline} className="stroke-border" strokeWidth="1" />
        <path d={idealPath} fill="none" className="stroke-muted-foreground" strokeWidth="1.5" strokeDasharray="4 4" strokeLinecap="round" />
        {actualPath && <path d={actualPath} fill="none" className="stroke-primary" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
        {todayIndex >= 0 && todayIndex < data.length && (
          <line x1={x(todayIndex)} x2={x(todayIndex)} y1={PAD_TOP - 4} y2={baseline} className="stroke-border" strokeWidth="1" />
        )}
        {picked !== null && data[picked].remaining !== null && (
          <circle cx={x(picked)} cy={y(data[picked].remaining!)} r="4" className="fill-primary" />
        )}
        {last && (
          <g>
            <circle cx={x(last.i)} cy={y(last.d.remaining!)} r="3.5" className="fill-primary" />
            <text x={Math.min(W - 6, x(last.i))} y={y(last.d.remaining!) - 8} textAnchor="middle" className="fill-foreground text-[10px] font-semibold tabular-nums">{last.d.remaining}</text>
          </g>
        )}
        {data.map((d, i) => (
          <g key={i}>
            <rect x={x(i) - plotW / data.length / 2} y={0} width={plotW / data.length} height={H} fill="transparent" onClick={() => setPicked(picked === i ? null : i)} className="cursor-pointer" />
            {(i === data.length - 1 || (i % labelEvery === 0 && data.length - 1 - i >= labelEvery)) && (
              <text x={x(i)} y={H - 5} textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"} className="fill-muted-foreground text-[10px]">{d.label}</text>
            )}
          </g>
        ))}
      </svg>
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <tbody>{data.map((d, i) => <tr key={i}><th scope="row">{d.label}</th><td>{describe(d)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
