"use client";

import { useRef, useState } from "react";
import { Download, Upload, Loader2, CheckCircle2, XCircle } from "lucide-react";

interface ImportResult {
  message: string;
  errors?: string[];
}

interface Props {
  exportUrl: string;
  importUrl: string;
  exportLabel?: string;
  importLabel?: string;
  templateColumns?: string;
}

export function CsvButtons({
  exportUrl,
  importUrl,
  exportLabel = "CSV İndir",
  importLabel = "CSV İçe Aktar",
  templateColumns,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [resultType, setResultType] = useState<"success" | "error">("success");

  const handleExport = () => {
    window.location.href = exportUrl;
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setResult(null);

    try {
      const text = await file.text();
      const res = await fetch(importUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        body: text,
      });
      const data = await res.json();

      if (!res.ok) {
        setResultType("error");
        setResult({ message: data.error || "İçe aktarma başarısız" });
      } else {
        setResultType("success");
        setResult({ message: data.message, errors: data.errors });
      }
    } catch {
      setResultType("error");
      setResult({ message: "Bağlantı hatası" });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Download size={14} />
          {exportLabel}
        </button>

        <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer">
          {importing ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Upload size={14} />
          )}
          {importing ? "Yükleniyor..." : importLabel}
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={handleImport}
            disabled={importing}
          />
        </label>
      </div>

      {templateColumns && (
        <p className="text-xs text-gray-400">
          Sütunlar: <code className="bg-gray-100 px-1 rounded">{templateColumns}</code>
        </p>
      )}

      {result && (
        <div
          className={`flex items-start gap-2 p-2.5 rounded-lg text-xs ${
            resultType === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {resultType === "success" ? (
            <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />
          ) : (
            <XCircle size={14} className="flex-shrink-0 mt-0.5" />
          )}
          <div>
            <p>{result.message}</p>
            {result.errors && result.errors.length > 0 && (
              <ul className="mt-1 space-y-0.5 opacity-80">
                {result.errors.map((e, i) => (
                  <li key={i}>• {e}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
