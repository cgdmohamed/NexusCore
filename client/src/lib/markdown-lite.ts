// A small, safe Markdown reader for the assistant's replies: headings, bold, italics, lists, quotes, code, links and tables.
// It builds a tree the screen renders as elements; nothing is ever inserted as HTML, so a reply cannot inject markup or script.

export type Inline =
  | { t: "text"; v: string }
  | { t: "b" | "i"; c: Inline[] }
  | { t: "code"; v: string }
  | { t: "a"; href: string; c: Inline[] };

export interface ListItem { inline: Inline[]; children: Block[] }
export type Block =
  | { t: "h"; level: number; c: Inline[] }
  | { t: "p"; c: Inline[] }
  | { t: "list"; ordered: boolean; items: ListItem[] }
  | { t: "quote"; c: Block[] }
  | { t: "hr" }
  | { t: "code"; v: string }
  | { t: "table"; head: Inline[][]; rows: Inline[][][] };

// Links only go where a person would expect: the web, an email, or somewhere inside the app
export const safeHref = (href: string): string | null => {
  const h = href.trim();
  return /^(https?:\/\/|mailto:|\/(?!\/))/i.test(h) ? h : null;
};

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let text = "";
  const flush = () => { if (text) { out.push({ t: "text", v: text }); text = ""; } };
  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);
    let m: RegExpMatchArray | null;
    if ((m = rest.match(/^`([^`\n]+)`/))) { flush(); out.push({ t: "code", v: m[1] }); i += m[0].length; continue; }
    if ((m = rest.match(/^\[([^\]\n]+)\]\(([^)\s]+)\)/))) {
      const href = safeHref(m[2]);
      if (href) { flush(); out.push({ t: "a", href, c: parseInline(m[1]) }); i += m[0].length; continue; }
    }
    if ((m = rest.match(/^(\*\*|__)(?=\S)([\s\S]*?\S)\1/))) { flush(); out.push({ t: "b", c: parseInline(m[2]) }); i += m[0].length; continue; }
    if ((m = rest.match(/^\*(?=[^\s*])([^*\n]*[^\s*])\*/)) || (m = rest.match(/^_(?=[^\s_])([^_\n]*[^\s_])_(?![\w])/))) { flush(); out.push({ t: "i", c: parseInline(m[1]) }); i += m[0].length; continue; }
    if (rest.startsWith("\\") && rest.length > 1 && /[\\`*_[\]()#>|-]/.test(rest[1])) { text += rest[1]; i += 2; continue; }
    text += src[i];
    i++;
  }
  flush();
  return out;
}

const LIST_ITEM = /^(\s*)([-*+•]|\d+[.)])\s+(.*)$/;
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const cells = (line: string) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => parseInline(c.trim()));

function parseList(lines: string[], start: number): { block: Block; next: number } {
  const first = lines[start].match(LIST_ITEM)!;
  const ordered = /\d/.test(first[2]);
  const baseIndent = first[1].length;
  const items: ListItem[] = [];
  let i = start;
  while (i < lines.length) {
    const m = lines[i].match(LIST_ITEM);
    if (m && m[1].length === baseIndent && /\d/.test(m[2]) === ordered) {
      items.push({ inline: parseInline(m[3]), children: [] });
      i++;
      continue;
    }
    if (m && m[1].length > baseIndent && items.length) {
      const nested = parseList(lines, i);
      items[items.length - 1].children.push(nested.block);
      i = nested.next;
      continue;
    }
    // a wrapped line of the item above
    if (lines[i].trim() && /^\s+\S/.test(lines[i]) && !m && items.length) {
      const last = items[items.length - 1];
      last.inline = [...last.inline, { t: "text", v: " " }, ...parseInline(lines[i].trim())];
      i++;
      continue;
    }
    break;
  }
  return { block: { t: "list", ordered, items }, next: i };
}

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  let para: string[] = [];
  const endPara = () => { if (para.length) { blocks.push({ t: "p", c: parseInline(para.join("\n")) }); para = []; } };

  while (i < lines.length) {
    const line = lines[i];
    let m: RegExpMatchArray | null;

    if (/^\s*```/.test(line)) {
      endPara();
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++]);
      i++;
      blocks.push({ t: "code", v: body.join("\n") });
      continue;
    }
    if (!line.trim()) { endPara(); i++; continue; }
    if ((m = line.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/))) { endPara(); blocks.push({ t: "h", level: m[1].length, c: parseInline(m[2]) }); i++; continue; }
    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) { endPara(); blocks.push({ t: "hr" }); i++; continue; }
    if (/^\s{0,3}>/.test(line)) {
      endPara();
      const quoted: string[] = [];
      while (i < lines.length && /^\s{0,3}>/.test(lines[i])) quoted.push(lines[i++].replace(/^\s{0,3}>\s?/, ""));
      blocks.push({ t: "quote", c: parseMarkdown(quoted.join("\n")) });
      continue;
    }
    if (line.includes("|") && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]) && lines[i + 1].includes("-")) {
      endPara();
      const head = cells(line);
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(cells(lines[i++]));
      blocks.push({ t: "table", head, rows });
      continue;
    }
    if (LIST_ITEM.test(line)) { endPara(); const { block, next } = parseList(lines, i); blocks.push(block); i = next; continue; }

    para.push(line.trim());
    i++;
  }
  endPara();
  return blocks;
}
