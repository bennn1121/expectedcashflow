"use client";

import { useState } from "react";
import Papa from "papaparse";
import {
  buildTransactions,
  detectColumnMapping,
  type ColumnMapping,
  type RawCsvRow,
  type SkippedRow,
} from "@/lib/csv";
import { importTransactionsAction } from "@/app/accounts/[id]/actions";

type Stage = "idle" | "previewing" | "importing" | "done";

export function CsvUpload({ accountId }: { accountId: string }) {
  const [stage, setStage] = useState<Stage>("idle");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<RawCsvRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: SkippedRow[] } | null>(null);

  function handleFile(file: File) {
    setParseError(null);
    setResult(null);
    file.text().then((text) => {
      Papa.parse<RawCsvRow>(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const fields = results.meta.fields ?? [];
          if (fields.length === 0 || results.data.length === 0) {
            setParseError("Couldn't find any rows in that file.");
            return;
          }
          setHeaders(fields);
          setRows(results.data);
          setMapping(detectColumnMapping(fields));
          setStage("previewing");
        },
        error: (err: Error) => setParseError(err.message),
      });
    });
  }

  function updateMapping(patch: Partial<ColumnMapping>) {
    setMapping((prev) => ({ ...(prev ?? { date: "", description: "", mode: "single" }), ...patch }) as ColumnMapping);
  }

  const mappingComplete =
    !!mapping?.date &&
    !!mapping?.description &&
    (mapping?.mode === "single" ? !!mapping.amount : !!(mapping?.debit || mapping?.credit));

  async function handleConfirm() {
    if (!mapping) return;
    setStage("importing");
    const { transactions, skipped } = buildTransactions(rows, mapping);
    try {
      await importTransactionsAction(accountId, transactions);
      setResult({ imported: transactions.length, skipped });
      setStage("done");
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Import failed.");
      setStage("previewing");
    }
  }

  function reset() {
    setStage("idle");
    setHeaders([]);
    setRows([]);
    setMapping(null);
    setParseError(null);
    setResult(null);
  }

  if (stage === "idle") {
    return (
      <div className="stack">
        <label className="dropzone">
          <input
            type="file"
            accept=".csv,text/csv"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          Click to choose a CSV of bank transactions
        </label>
        {parseError && <div className="form-error">{parseError}</div>}
      </div>
    );
  }

  if (stage === "done" && result) {
    return (
      <div className="stack">
        <div className="form-error" style={{ background: "rgba(47,158,110,0.09)", borderColor: "rgba(47,158,110,0.35)", color: "var(--forest-ink)" }}>
          Imported {result.imported} transaction{result.imported === 1 ? "" : "s"}.
          {result.skipped.length > 0 && ` Skipped ${result.skipped.length} row${result.skipped.length === 1 ? "" : "s"}.`}
        </div>
        {result.skipped.length > 0 && (
          <ul className="skip-summary">
            {result.skipped.slice(0, 10).map((s) => (
              <li key={s.row}>
                Row {s.row}: {s.reason}
              </li>
            ))}
            {result.skipped.length > 10 && <li>…and {result.skipped.length - 10} more</li>}
          </ul>
        )}
        <button className="btn btn-secondary" onClick={reset} style={{ alignSelf: "flex-start" }}>
          Upload another file
        </button>
      </div>
    );
  }

  const preview = rows.slice(0, 10);

  return (
    <div className="stack">
      {parseError && <div className="form-error">{parseError}</div>}

      <div className="mapping-grid">
        <div className="field">
          <label>Date column</label>
          <select value={mapping?.date ?? ""} onChange={(e) => updateMapping({ date: e.target.value })}>
            <option value="">Choose…</option>
            {headers.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Description column</label>
          <select value={mapping?.description ?? ""} onChange={(e) => updateMapping({ description: e.target.value })}>
            <option value="">Choose…</option>
            {headers.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Amount format</label>
          <select
            value={mapping?.mode ?? "single"}
            onChange={(e) => updateMapping({ mode: e.target.value as ColumnMapping["mode"] })}
          >
            <option value="single">Single signed amount</option>
            <option value="debit-credit">Separate debit / credit</option>
          </select>
        </div>

        {mapping?.mode === "debit-credit" ? (
          <>
            <div className="field">
              <label>Debit column</label>
              <select value={mapping?.debit ?? ""} onChange={(e) => updateMapping({ debit: e.target.value })}>
                <option value="">Choose…</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Credit column</label>
              <select value={mapping?.credit ?? ""} onChange={(e) => updateMapping({ credit: e.target.value })}>
                <option value="">Choose…</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : (
          <div className="field">
            <label>Amount column</label>
            <select value={mapping?.amount ?? ""} onChange={(e) => updateMapping({ amount: e.target.value })}>
              <option value="">Choose…</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="table-scroll">
        <table className="ledger">
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.map((row, i) => (
              <tr key={i}>
                {headers.map((h) => (
                  <td key={h}>{row[h]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="form-note">Showing the first {preview.length} of {rows.length} parsed rows.</p>

      <div style={{ display: "flex", gap: 12 }}>
        <button
          className="btn btn-primary"
          disabled={!mappingComplete || stage === "importing"}
          onClick={handleConfirm}
        >
          {stage === "importing" ? "Importing…" : `Import ${rows.length} rows`}
        </button>
        <button className="btn btn-secondary" onClick={reset}>
          Cancel
        </button>
      </div>
    </div>
  );
}
