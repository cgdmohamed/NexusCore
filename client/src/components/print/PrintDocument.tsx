import { useEffect, type CSSProperties, type ReactNode } from "react";
import { useTranslation } from "@/lib/i18n";
import { statusStyle, type PrintCompany } from "@/lib/print-format";

// One look for every printed document. The invoice is the reference: the quotation and the client
// statement are built from the same parts, so a change here changes all three.
// Fixed light colours keep the page identical on screen, on paper and as PDF.

export const INK = "#1a1a2e";
export const MUTED = "#6b7280";
export const FAINT = "#9ca3af";
export const LINE = "#f3f4f6";

export function useAutoPrint(ready: boolean, delay = 800) {
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => window.print(), delay);
    return () => clearTimeout(timer);
  }, [ready, delay]);
}

export function PrintMessage({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: error ? "#dc2626" : MUTED }}>
      {children}
    </div>
  );
}

export function PrintPage({ children }: { children: ReactNode }) {
  const { t, language } = useTranslation();
  return (
    <div dir={language === "ar" ? "rtl" : "ltr"}>
      <style>{`
        *{box-sizing:border-box}
        @media print {
          body { margin: 0; padding: 0; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 1cm; }
        }
        body { font-family: 'Helvetica Neue', Arial, 'Noto Naskh Arabic', sans-serif; font-size: 13px; color: ${INK}; background: #fff !important; }
      `}</style>
      <div className="no-print" style={{ background: "#fefce8", borderBottom: "1px solid #fde68a", color: "#92400e", padding: "8px 16px", fontSize: 13, textAlign: "center" }}>
        {t("doc.notice")}
      </div>
      <div style={{ padding: 48, maxWidth: 900, margin: "0 auto", background: "#fff", color: INK, lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

const metaCell: CSSProperties = { padding: "4px 0", fontSize: 12 };

export function DocHeader({ company, title, meta, status }: {
  company: PrintCompany;
  title: string;
  meta: [string, ReactNode][];
  status?: string;
}) {
  const { t } = useTranslation();
  const badge = statusStyle(status);
  const small: CSSProperties = { fontSize: 11.5, color: MUTED, lineHeight: 1.7 };
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24, marginBottom: 48, paddingBottom: 32, borderBottom: `3px solid ${INK}` }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 3, maxWidth: 280 }}>
        <img src="/assets/logo.png" alt={company.name} style={{ width: 72, height: 72, objectFit: "contain", marginBottom: 14, alignSelf: "flex-start" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{company.name}</div>
        {company.address && <div style={small}>{company.address}</div>}
        {company.phone && <div style={small}>{t("doc.tel")}: <bdi dir="ltr">{company.phone}</bdi></div>}
        {company.email && <div style={small}><bdi dir="ltr">{company.email}</bdi></div>}
        {(company.vatNumber || company.regNumber) && (
          <div style={small}>
            {company.vatNumber && <>{t("stmt.company_vat")} <bdi dir="ltr">{company.vatNumber}</bdi> </>}
            {company.regNumber && <>{t("stmt.company_reg")} <bdi dir="ltr">{company.regNumber}</bdi></>}
          </div>
        )}
      </div>
      <div style={{ textAlign: "end" }}>
        <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: 3, marginBottom: 18 }}>{title}</div>
        <table style={{ marginInlineStart: "auto", borderCollapse: "collapse" }}>
          <tbody>
            {meta.map(([label, value]) => (
              <tr key={label}>
                <td style={{ ...metaCell, paddingInlineStart: 28, color: FAINT, whiteSpace: "nowrap", textAlign: "start" }}>{label}</td>
                <td style={{ ...metaCell, paddingInlineStart: 28, fontWeight: 600, textAlign: "start" }}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {status && (
          <div style={{ marginTop: 14 }}>
            <span style={{ display: "inline-block", padding: "5px 14px", borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, background: badge.background, color: badge.color }}>
              {t(`doc.status.${status}`) === `doc.status.${status}` ? status.replace(/_/g, " ").toUpperCase() : t(`doc.status.${status}`)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 6, padding: "10px 16px", marginBottom: 28, fontSize: 12, color: MUTED }}>{children}</div>;
}

export const sectionLabel: CSSProperties = { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2, color: FAINT, marginBottom: 8 };

// "Bill to" and the client of a statement: the same panel
export function Party({ label, name, lines, aside }: { label: string; name: string; lines: (string | undefined | null)[]; aside?: ReactNode }) {
  return (
    <div style={{ marginBottom: 36, padding: "20px 24px", background: "#f9fafb", borderInlineStart: `4px solid ${INK}`, borderStartEndRadius: 6, borderEndEndRadius: 6, display: "flex", justifyContent: "space-between", gap: 24 }}>
      <div>
        <div style={sectionLabel}>{label}</div>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{name || "—"}</div>
        {lines.filter(Boolean).map((l, i) => <div key={i} style={{ fontSize: 12, color: MUTED, lineHeight: 1.7 }}><bdi>{l}</bdi></div>)}
      </div>
      {aside && <div style={{ textAlign: "end" }}>{aside}</div>}
    </div>
  );
}

export const th = (align: "start" | "end" = "start"): CSSProperties => ({
  padding: "13px 16px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, color: "#fff", textAlign: align,
});
export const td = (align: "start" | "end" = "start", strong = false): CSSProperties => ({
  padding: "13px 16px", fontSize: 13, color: "#374151", textAlign: align, verticalAlign: "top", fontWeight: strong ? 600 : 400,
});

export function DocTable({ columns, children }: { columns: { label: string; align?: "start" | "end" }[]; children: ReactNode }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 36 }}>
      <thead>
        <tr style={{ background: INK }}>{columns.map((c) => <th key={c.label} style={th(c.align)}>{c.label}</th>)}</tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

export const rowStyle = (idx: number): CSSProperties => ({ borderBottom: `1px solid ${LINE}`, background: idx % 2 === 1 ? "#f9fafb" : "#fff", breakInside: "avoid" });

export function Amount({ children }: { children: ReactNode }) {
  return <bdi dir="ltr" style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{children}</bdi>;
}

export interface TotalRow { label: string; value: ReactNode; tone?: "good" | "bad"; big?: boolean }

// Lines above the total, the total itself between two rules, then the lines that follow it (paid, balance due)
export function Totals({ before, total, after = [] }: { before: TotalRow[]; total: TotalRow; after?: TotalRow[] }) {
  const line: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", fontSize: 13, borderBottom: `1px solid ${LINE}`, gap: 12 };
  const color = (tone?: "good" | "bad") => (tone === "good" ? "#16a34a" : tone === "bad" ? "#dc2626" : INK);
  const render = (r: TotalRow) => (
    <div key={r.label} style={r.big ? { ...line, padding: "12px 0 7px", fontSize: 16, fontWeight: 800, borderBottom: "none" } : line}>
      <span style={{ color: MUTED }}>{r.label}</span>
      <span style={{ fontWeight: r.big ? 800 : 600, color: color(r.tone) }}>{r.value}</span>
    </div>
  );
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 48, breakInside: "avoid" }}>
      <div style={{ width: 300 }}>
        {before.map(render)}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", fontSize: 15, fontWeight: 700, borderTop: `2px solid ${INK}`, borderBottom: `2px solid ${INK}`, marginTop: 4 }}>
          <span style={{ color: MUTED }}>{total.label}</span>
          <span>{total.value}</span>
        </div>
        {after.map(render)}
      </div>
    </div>
  );
}

export function TextBlock({ label, text }: { label: string; text?: string | null }) {
  if (!text) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ ...sectionLabel, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.7, whiteSpace: "pre-line" }}>{text}</div>
    </div>
  );
}

export function SummaryTiles({ tiles }: { tiles: { label: string; value: ReactNode }[] }) {
  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
      {tiles.map((tile) => (
        <div key={tile.label} style={{ flex: 1, padding: "12px 14px", border: "1px solid #e5e7eb", borderRadius: 6, background: "#f9fafb" }}>
          <div style={{ color: MUTED, fontSize: 11 }}>{tile.label}</div>
          <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: "nowrap" }}>{tile.value}</div>
        </div>
      ))}
    </div>
  );
}

export function DocFooter({ lines, company }: { lines: string[]; company: PrintCompany }) {
  const { t } = useTranslation();
  return (
    <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 24, fontSize: 11, color: FAINT, lineHeight: 1.7 }}>
      {lines.map((l, i) => <p key={i} style={{ marginBottom: 8 }}>{l}</p>)}
      <p>{t("doc.thanks", { name: company.name })}</p>
    </div>
  );
}
