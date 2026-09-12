"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import {
  parseTransactionSheetRows,
  parseAccountInfoSheet,
  diffTransactions,
  diffAccountInfo,
  type CleanImportRow,
  type SkippedImportRow,
  type AccountInfoValues,
  type TransactionDiff,
  type AccountInfoDiff,
} from "@/lib/excel";
import { getAccountImportSnapshotAction, commitExcelImportAction, type ExcelImportSummary } from "@/app/accounts/[id]/actions";
import { useLocale } from "@/components/LocaleProvider";
import { pluralS } from "@/lib/i18n";

type Stage = "idle" | "reviewing" | "importing" | "done";

interface Review {
  cleanRows: CleanImportRow[];
  skipped: SkippedImportRow[];
  accountInfoPatch: Partial<AccountInfoValues>;
  txDiff: TransactionDiff;
  accountDiff: AccountInfoDiff;
}

const REQUIRED_SHEETS = ["Transactions", "Account Info"] as const;

export function ExcelUpload({ accountId }: { accountId: string }) {
  const { t, locale } = useLocale();
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [summary, setSummary] = useState<ExcelImportSummary | null>(null);

  async function handleFile(file: File) {
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array", cellDates: true });

      for (const sheetName of REQUIRED_SHEETS) {
        if (!wb.Sheets[sheetName]) {
          setError(t("excelMissingSheet", { sheet: sheetName }));
          return;
        }
      }

      const rawTxRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["Transactions"], { defval: null });
      const rawInfoRows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets["Account Info"], { header: 1 });

      const { rows: cleanRows, skipped } = parseTransactionSheetRows(rawTxRows);
      const accountInfoPatch = parseAccountInfoSheet(rawInfoRows);

      const snapshot = await getAccountImportSnapshotAction(accountId);
      const txDiff = diffTransactions(cleanRows, snapshot.transactions);
      const accountDiff = diffAccountInfo(accountInfoPatch, snapshot.account);

      setReview({ cleanRows, skipped, accountInfoPatch, txDiff, accountDiff });
      setStage("reviewing");
    } catch {
      setError(t("excelParseError"));
    }
  }

  async function handleConfirm() {
    if (!review) return;
    setStage("importing");
    setError(null);
    try {
      const result = await commitExcelImportAction(accountId, review.cleanRows, review.accountInfoPatch);
      setSummary(result);
      setStage("done");
    } catch {
      setError(t("excelParseError"));
      setStage("reviewing");
    }
  }

  function reset() {
    setStage("idle");
    setError(null);
    setReview(null);
    setSummary(null);
  }

  if (stage === "idle") {
    return (
      <div className="stack">
        <label className="dropzone">
          <input
            type="file"
            accept=".xlsx"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          {t("excelDropzone")}
        </label>
        {error && <div className="form-error">{error}</div>}
      </div>
    );
  }

  if (stage === "done" && summary) {
    return (
      <div className="stack">
        <div
          className="form-error"
          style={{ background: "rgba(47,158,110,0.09)", borderColor: "rgba(47,158,110,0.35)", color: "var(--forest-ink)" }}
        >
          {t("excelImportDone", { inserted: summary.insertCount, updated: summary.updateCount, deleted: summary.deleteCount })}
        </div>
        <button className="btn btn-secondary" onClick={reset} style={{ alignSelf: "flex-start" }}>
          {t("csvUploadAnother")}
        </button>
      </div>
    );
  }

  if ((stage === "reviewing" || stage === "importing") && review) {
    const { txDiff, accountDiff, skipped } = review;
    const hasTxChanges = txDiff.toInsert.length + txDiff.toUpdate.length + txDiff.toDeleteIds.length > 0;
    const hasAccountChanges = Object.keys(accountDiff).length > 0;

    return (
      <div className="stack">
        {error && <div className="form-error">{error}</div>}

        <h3 style={{ fontSize: "1rem" }}>{t("excelReviewHeading")}</h3>

        {hasTxChanges ? (
          <ul className="skip-summary" style={{ color: "var(--ink)" }}>
            {txDiff.toInsert.length > 0 && (
              <li>{t("excelNewTransactions", { count: txDiff.toInsert.length, plural: pluralS(txDiff.toInsert.length, locale) })}</li>
            )}
            {txDiff.toUpdate.length > 0 && (
              <li>{t("excelUpdatedTransactions", { count: txDiff.toUpdate.length, plural: pluralS(txDiff.toUpdate.length, locale) })}</li>
            )}
            {txDiff.toDeleteIds.length > 0 && (
              <li>{t("excelDeletedTransactions", { count: txDiff.toDeleteIds.length, plural: pluralS(txDiff.toDeleteIds.length, locale) })}</li>
            )}
          </ul>
        ) : (
          <p className="form-note">{t("excelNoTransactionChanges")}</p>
        )}

        <div>
          <p className="form-note" style={{ marginBottom: 8 }}>
            <strong>{t("excelAccountChangesHeading")}</strong>
          </p>
          {hasAccountChanges ? (
            <ul className="skip-summary" style={{ color: "var(--ink)" }}>
              {accountDiff.name !== undefined && (
                <li>
                  {t("businessNameLabel")}: {accountDiff.name}
                </li>
              )}
              {accountDiff.currency !== undefined && (
                <li>
                  {t("currencyLabel")}: {accountDiff.currency}
                </li>
              )}
              {accountDiff.minimum_buffer !== undefined && (
                <li>
                  {t("minimumBufferLabel")}: {accountDiff.minimum_buffer}
                </li>
              )}
              {accountDiff.starting_balance_override !== undefined && (
                <li>
                  {t("startingBalanceOverrideLabel")}: {accountDiff.starting_balance_override ?? "—"}
                </li>
              )}
            </ul>
          ) : (
            <p className="form-note">{t("excelNoAccountChanges")}</p>
          )}
        </div>

        {skipped.length > 0 && (
          <div>
            <p className="form-note" style={{ marginBottom: 8 }}>
              <strong>{t("excelSkippedRowsHeading")}</strong>
            </p>
            <ul className="skip-summary">
              {skipped.slice(0, 10).map((s) => (
                <li key={s.row}>{t("csvRowLabel", { row: s.row, reason: s.reason })}</li>
              ))}
              {skipped.length > 10 && <li>{t("csvAndMore", { count: skipped.length - 10 })}</li>}
            </ul>
          </div>
        )}

        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn btn-primary" disabled={stage === "importing"} onClick={handleConfirm}>
            {stage === "importing" ? t("excelImporting") : t("excelConfirmImport")}
          </button>
          <button className="btn btn-secondary" onClick={reset} disabled={stage === "importing"}>
            {t("csvCancel")}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
