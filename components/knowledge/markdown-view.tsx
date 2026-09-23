"use client";
import type { ReactNode } from "react";

function inline(text: string): ReactNode[] {
  const tokens = text.split(/(\x60[^\x60]+\x60|\*\*[^\*]+\*\*|\*[^\*]+\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g);
  return tokens.filter(Boolean).map((token, i) => {
    if (token.startsWith("\x60") && token.endsWith("\x60"))
      return <code key={i} className="markdown-inline-code">{token.slice(1, -1)}</code>;
    if (token.startsWith("**") && token.endsWith("**"))
      return <strong key={i}>{token.slice(2, -2)}</strong>;
    if (token.startsWith("*") && token.endsWith("*"))
      return <em key={i}>{token.slice(1, -1)}</em>;
    const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (link)
      return (
        <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer">
          {link[1]} ↗
        </a>
      );
    return <span key={i}>{token}</span>;
  });
}

export function MarkdownView({ value }: { value: string }) {
  const lines = value.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }
    if (line.trim().startsWith("\x60\x60\x60")) {
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("\x60\x60\x60")) {
        code.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push(
        <pre key={i} className="markdown-code"><code>{code.join("\n")}</code></pre>,
      );
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const Tag = heading[1].length === 1 ? "h2" : heading[1].length === 2 ? "h3" : "h4";
      blocks.push(<Tag key={i}>{inline(heading[2])}</Tag>);
      i += 1;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ul key={i}>{items.map((item, n) => <li key={n}>{inline(item)}</li>)}</ul>,
      );
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ol key={i}>{items.map((item, n) => <li key={n}>{inline(item)}</li>)}</ol>,
      );
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push(<blockquote key={i}>{quote.map((q, n) => <p key={n}>{inline(q)}</p>)}</blockquote>);
      continue;
    }
    const paragraph: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^#{1,3}\s+/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i]) &&
      !/^>\s?/.test(lines[i]) &&
      !lines[i].trim().startsWith("\x60\x60\x60")
    ) {
      paragraph.push(lines[i]);
      i += 1;
    }
    blocks.push(<p key={i}>{inline(paragraph.join("\n"))}</p>);
  }
  return <div className="markdown-body">{blocks}</div>;
}
