"use client";
import { useState } from "react";
import { extractPdfText } from "@/lib/knowledge/pdf";

/** Load study material from a text, Markdown or PDF file on the device. */
export function FileMaterial({
  onText,
  disabled,
  limit = 12000,
}: {
  onText: (text: string, name: string) => void;
  disabled?: boolean;
  limit?: number;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [name, setName] = useState("");
  const load = async (file: File) => {
    setBusy(true);
    setError("");
    try {
      const lower = file.name.toLowerCase();
      let text: string;
      if (lower.endsWith(".pdf")) {
        const pdf = await extractPdfText(
          new Uint8Array(await file.arrayBuffer()),
          limit,
        );
        text = pdf.text;
        setName(
          `${file.name} · ${pdf.pages} хуудас${pdf.truncated ? `, эхний ${limit.toLocaleString("mn-MN")} тэмдэгт` : ""}`,
        );
      } else if (/\.(txt|md|markdown)$/i.test(lower)) {
        if (file.size > 2 * 1024 * 1024)
          throw Error("Текст файл 2 MB-аас бага байх ёстой.");
        text = (await file.text()).slice(0, limit);
        setName(
          `${file.name} · ${text.length.toLocaleString("mn-MN")} тэмдэгт`,
        );
      } else throw Error("PDF, TXT эсвэл Markdown файл сонгоно уу.");
      if (!text.trim()) throw Error("Файлаас текст олдсонгүй.");
      onText(text, file.name.replace(/\.[^.]+$/, ""));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Файлыг уншиж чадсангүй.");
      setName("");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="form-stack">
      <label className="button file-button">
        {busy ? "Файлыг уншиж байна…" : "PDF / текст файл сонгох"}
        <input
          type="file"
          accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
          disabled={disabled || busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void load(file);
          }}
        />
      </label>
      {name && <p className="tiny muted">{name}</p>}
      {error && (
        <p className="tiny" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
