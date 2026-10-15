import type { ReactNode } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { parseMarkdown, type Block, type Inline } from "@/lib/markdown-lite";

function Inlines({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, i): ReactNode => {
        switch (n.t) {
          case "text": return n.v.split("\n").flatMap((part, j) => (j === 0 ? [part] : [<br key={`br${i}-${j}`} />, part]));
          case "b": return <strong key={i} className="font-semibold"><Inlines nodes={n.c} /></strong>;
          case "i": return <em key={i}><Inlines nodes={n.c} /></em>;
          case "code": return <code key={i} dir="ltr" className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{n.v}</code>;
          case "a": return n.href.startsWith("/")
            ? <Link key={i} href={n.href} className="font-medium text-primary underline underline-offset-2"><Inlines nodes={n.c} /></Link>
            : <a key={i} href={n.href} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2"><Inlines nodes={n.c} /></a>;
        }
      })}
    </>
  );
}

const HEADING = ["", "text-lg font-bold", "text-base font-bold", "text-[15px] font-semibold", "text-[15px] font-semibold", "text-sm font-semibold", "text-sm font-semibold"];

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i): ReactNode => {
        switch (b.t) {
          case "h": return <p key={i} dir="auto" role="heading" aria-level={Math.min(b.level + 1, 6)} className={cn("mt-3 first:mt-0", HEADING[b.level])}><Inlines nodes={b.c} /></p>;
          case "p": return <p key={i} dir="auto" className="break-words"><Inlines nodes={b.c} /></p>;
          case "hr": return <hr key={i} className="my-2 border-border" />;
          case "code": return <pre key={i} dir="ltr" className="overflow-x-auto rounded-lg bg-muted p-2.5 text-left font-mono text-xs"><code>{b.v}</code></pre>;
          case "quote": return <blockquote key={i} className="space-y-1 border-s-2 border-primary/40 ps-3 text-muted-foreground"><Blocks blocks={b.c} /></blockquote>;
          case "list": {
            const Tag = b.ordered ? "ol" : "ul";
            return (
              <Tag key={i} className={cn("space-y-1 ps-5", b.ordered ? "list-decimal" : "list-disc")}>
                {b.items.map((item, j) => (
                  <li key={j} dir="auto" className="break-words marker:text-muted-foreground">
                    <Inlines nodes={item.inline} />
                    {item.children.length > 0 && <div className="mt-1 space-y-1"><Blocks blocks={item.children} /></div>}
                  </li>
                ))}
              </Tag>
            );
          }
          case "table": return (
            <div key={i} className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full border-collapse text-start text-[13px]">
                <thead className="bg-muted/60"><tr>{b.head.map((c, j) => <th key={j} dir="auto" className="border-b border-border px-2.5 py-1.5 text-start font-semibold"><Inlines nodes={c} /></th>)}</tr></thead>
                <tbody>{b.rows.map((r, j) => <tr key={j} className="border-b border-border last:border-b-0">{r.map((c, k) => <td key={k} dir="auto" className="px-2.5 py-1.5 align-top"><Inlines nodes={c} /></td>)}</tr>)}</tbody>
              </table>
            </div>
          );
        }
      })}
    </>
  );
}

// The assistant's reply, laid out: headings, bold, lists and tables instead of the raw # and ** marks
export function AssistantMarkdown({ text }: { text: string }) {
  return <div className="space-y-2 text-[15px] leading-relaxed" data-testid="assistant-markdown"><Blocks blocks={parseMarkdown(text)} /></div>;
}
