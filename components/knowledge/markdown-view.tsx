"use client";

import type { ReactNode } from "react";
import { useState } from "react";

const LATEX_SYMBOLS: Record<string, string> = {
  "\\alpha": "α",
  "\\beta": "β",
  "\\gamma": "γ",
  "\\delta": "δ",
  "\\Delta": "Δ",
  "\\epsilon": "ε",
  "\\theta": "θ",
  "\\Theta": "Θ",
  "\\lambda": "λ",
  "\\Lambda": "Λ",
  "\\mu": "μ",
  "\\pi": "π",
  "\\Pi": "Π",
  "\\sigma": "σ",
  "\\Sigma": "∑",
  "\\omega": "ω",
  "\\Omega": "Ω",
  "\\sum": "∑",
  "\\prod": "∏",
  "\\int": "∫",
  "\\infty": "∞",
  "\\approx": "≈",
  "\\neq": "≠",
  "\\leq": "≤",
  "\\geq": "≥",
  "\\le": "≤",
  "\\ge": "≥",
  "\\pm": "±",
  "\\times": "×",
  "\\cdot": "·",
  "\\div": "÷",
  "\\rightarrow": "→",
  "\\leftarrow": "←",
  "\\Rightarrow": "⇒",
  "\\leftrightarrow": "↔",
  "\\partial": "∂",
  "\\nabla": "∇",
  "\\in": "∈",
  "\\notin": "∉",
  "\\subset": "⊂",
  "\\cup": "∪",
  "\\cap": "∩",
  "\\forall": "∀",
  "\\exists": "∃",
};

export function formatMathTex(raw: string): ReactNode {
  let tex = raw.trim();
  // Replace \frac{a}{b} -> (a)/(b) or visual fraction
  tex = tex.replace(
    /\\frac\{([^{}]+)\}\{([^{}]+)\}/g,
    (_, num: string, den: string) => `(${num})⁄(${den})`,
  );
  tex = tex.replace(/\\sqrt\{([^{}]+)\}/g, (_, rad: string) => `√(${rad})`);
  for (const [cmd, sym] of Object.entries(LATEX_SYMBOLS)) {
    tex = tex.split(cmd).join(sym);
  }
  // Tokenize superscripts ^{...} / ^x and subscripts _{...} / _x
  const nodes: ReactNode[] = [];
  const tokenRe = /(\^\{[^{}]+\}|\^[A-Za-z0-9+-]|_\{[^{}]+\}|_[A-Za-z0-9+-])/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let k = 0;
  while ((match = tokenRe.exec(tex)) !== null) {
    if (match.index > last) {
      nodes.push(tex.slice(last, match.index));
    }
    const tok = match[0];
    const clean = tok.slice(1).replace(/^\{|\}$/g, "");
    if (tok.startsWith("^")) {
      nodes.push(
        <sup key={`sup-${k++}`} className="text-[0.78em] leading-none">
          {clean}
        </sup>,
      );
    } else {
      nodes.push(
        <sub key={`sub-${k++}`} className="text-[0.78em] leading-none">
          {clean}
        </sub>,
      );
    }
    last = match.index + tok.length;
  }
  if (last < tex.length) {
    nodes.push(tex.slice(last));
  }
  return nodes;
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="my-2.5 overflow-hidden rounded-xl border border-white/10 bg-slate-950/90 text-left">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-slate-400">
        <span className="font-mono uppercase tracking-wider text-indigo-300">
          {lang || "code"}
        </span>
        <button
          type="button"
          onClick={() => {
            if (navigator.clipboard) {
              void navigator.clipboard.writeText(code);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }
          }}
          className="rounded-md px-2 py-0.5 text-[11px] text-slate-300 hover:bg-white/10"
        >
          {copied ? "✓ Хуулсан" : "Хуулах"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-emerald-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** Controlled Markdown + LaTeX Math ($...$ / $$...$$) + Code renderer: no raw HTML or external images. */
export function MarkdownView({
  value,
  body,
}: {
  value?: string;
  body?: string;
}) {
  const source = value ?? body ?? "";
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let key = 0;

  const flush = () => {
    if (!list.length) return;
    const items = list;
    list = [];
    blocks.push(
      <ul key={key++}>
        {items.map((item, i) => (
          <li key={i}>{inline(item)}</li>
        ))}
      </ul>,
    );
  };

  for (let idx = 0; idx < lines.length; idx += 1) {
    const raw = lines[idx];
    const line = raw.trimEnd();

    // Fenced code block ```lang ... ```
    if (line.trimStart().startsWith("```")) {
      flush();
      const lang = line.trimStart().slice(3).trim();
      const codeLines: string[] = [];
      idx += 1;
      while (idx < lines.length && !lines[idx].trimStart().startsWith("```")) {
        codeLines.push(lines[idx]);
        idx += 1;
      }
      blocks.push(
        <CodeBlock key={key++} lang={lang} code={codeLines.join("\n")} />,
      );
      continue;
    }

    // Display math block $$ ... $$
    if (line.trim().startsWith("$$")) {
      flush();
      const singleLineMatch = line.trim().match(/^\$\$(.+)\$\$$/);
      if (singleLineMatch) {
        blocks.push(
          <div
            key={key++}
            className="math-block my-2.5 overflow-x-auto rounded-xl border border-indigo-400/25 bg-indigo-950/30 px-4 py-2.5 text-center font-serif text-base italic text-indigo-100"
          >
            {formatMathTex(singleLineMatch[1])}
          </div>,
        );
        continue;
      }
      const mathLines: string[] = [line.trim().slice(2)];
      idx += 1;
      while (idx < lines.length && !lines[idx].trim().endsWith("$$")) {
        mathLines.push(lines[idx]);
        idx += 1;
      }
      if (idx < lines.length) {
        mathLines.push(lines[idx].trim().slice(0, -2));
      }
      blocks.push(
        <div
          key={key++}
          className="math-block my-2.5 overflow-x-auto rounded-xl border border-indigo-400/25 bg-indigo-950/30 px-4 py-2.5 text-center font-serif text-base italic text-indigo-100"
        >
          {formatMathTex(mathLines.join(" "))}
        </div>,
      );
      continue;
    }

    if (!line.trim()) {
      flush();
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      list.push(line.replace(/^[-*]\s+/, ""));
      continue;
    }
    flush();
    if (line.startsWith("### "))
      blocks.push(<h4 key={key++}>{inline(line.slice(4))}</h4>);
    else if (line.startsWith("## "))
      blocks.push(<h3 key={key++}>{inline(line.slice(3))}</h3>);
    else if (line.startsWith("# "))
      blocks.push(<h2 key={key++}>{inline(line.slice(2))}</h2>);
    else blocks.push(<p key={key++}>{inline(line)}</p>);
  }
  flush();
  return <div className="markdown-body">{blocks}</div>;
}

function inline(text: string): ReactNode[] {
  const parts: ReactNode[] = [],
    pattern =
      /(\$\$[^$]+\$\$|\$[^$\n]+\$|`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0,
    match: RegExpExecArray | null,
    key = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("$$") && token.endsWith("$$")) {
      parts.push(
        <span
          key={key++}
          className="math-inline mx-1 inline-block rounded bg-indigo-500/15 px-1.5 py-0.5 font-serif italic text-indigo-200"
        >
          {formatMathTex(token.slice(2, -2))}
        </span>,
      );
    } else if (token.startsWith("$") && token.endsWith("$")) {
      parts.push(
        <span
          key={key++}
          className="math-inline mx-0.5 inline-block rounded bg-indigo-500/15 px-1.5 py-0.5 font-serif italic text-indigo-200"
        >
          {formatMathTex(token.slice(1, -1))}
        </span>,
      );
    } else if (token.startsWith("`")) {
      parts.push(<code key={key++}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**")) {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else {
      const link = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(token);
      parts.push(
        link ? (
          <a
            key={key++}
            href={link[2]}
            target="_blank"
            rel="noopener noreferrer"
          >
            {link[1]} ↗
          </a>
        ) : (
          token
        ),
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
