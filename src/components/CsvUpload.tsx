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
import { useLocale } from "@/components/LocaleProvider";
import { pluralS } from "@/lib/i18n";

type Stage = "idle" | "previewing" | "importing" | "done";

export function CsvUpload({ accountId }: { accountId: string }) {
  const { t, locale } = useLocale();
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
          {t("csvDropzone")}
        </label>
        {parseError && <div className="form-error">{parseError}</div>}
      </div>
    );
  }

  if (stage === "done" && result) {
    return (
      <div className="stack">
        <div className="form-error" style={{ background: "rgba(47,158,110,0.09)", borderColor: "rgba(47,158,110,0.35)", color: "var(--forest-ink)" }}>
          {t("csvImported", { count: result.imported, plural: pluralS(result.imported, locale) })}
          {result.skipped.length > 0 && t("csvSkipped", { count: result.skipped.length, plural: pluralS(result.skipped.length, locale) })}
        </div>
        {result.skipped.length > 0 && (
          <ul className="skip-summary">
            {result.skipped.slice(0, 10).map((s) => (
              <li key={s.row}>{t("csvRowLabel", { row: s.row, reason: s.reason })}</li>
            ))}
            {result.skipped.length > 10 && <li>{t("csvAndMore", { count: result.skipped.length - 10 })}</li>}
          </ul>
        )}
        <button className="btn btn-secondary" onClick={reset} style={{ alignSelf: "flex-start" }}>
          {t("csvUploadAnother")}
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
          <label>{t("csvDateColumn")}</label>
          <select value={mapping?.date ?? ""} onChange={(e) => updateMapping({ date: e.target.value })}>
            <option value="">{t("csvChoose")}</option>
            {headers.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>{t("csvDescriptionColumn")}</label>
          <select value={mapping?.description ?? ""} onChange={(e) => updateMapping({ description: e.target.value })}>
            <option value="">{t("csvChoose")}</option>
            {headers.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>{t("csvAmountFormat")}</label>
          <select
            value={mapping?.mode ?? "single"}
            onChange={(e) => updateMapping({ mode: e.target.value as ColumnMapping["mode"] })}
          >
            <option value="single">{t("csvSingleSignedAmount")}</option>
            <option value="debit-credit">{t("csvSeparateDebitCredit")}</option>
          </select>
        </div>

        {mapping?.mode === "debit-credit" ? (
          <>
            <div className="field">
              <label>{t("csvDebitColumn")}</label>
              <select value={mapping?.debit ?? ""} onChange={(e) => updateMapping({ debit: e.target.value })}>
                <option value="">{t("csvChoose")}</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{t("csvCreditColumn")}</label>
              <select value={mapping?.credit ?? ""} onChange={(e) => updateMapping({ credit: e.target.value })}>
                <option value="">{t("csvChoose")}</option>
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
            <label>{t("csvAmountColumn")}</label>
            <select value={mapping?.amount ?? ""} onChange={(e) => updateMapping({ amount: e.target.value })}>
              <option value="">{t("csvChoose")}</option>
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
      <p className="form-note">{t("csvShowingRows", { shown: preview.length, total: rows.length })}</p>

      <div style={{ display: "flex", gap: 12 }}>
        <button
          className="btn btn-primary"
          disabled={!mappingComplete || stage === "importing"}
          onClick={handleConfirm}
        >
          {stage === "importing" ? t("csvImporting") : t("csvImportRows", { count: rows.length })}
        </button>
        <button className="btn btn-secondary" onClick={reset}>
          {t("csvCancel")}
        </button>
      </div>
    </div>
  );
}
