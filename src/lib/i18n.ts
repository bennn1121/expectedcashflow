// Plain translation dictionary — no i18n library, just a lookup keyed by
// string id. `t()` in LocaleProvider does `{n}`-style placeholder
// substitution for the handful of strings that need one.

export type Locale = "en" | "he";

export const LOCALE_DIR: Record<Locale, "ltr" | "rtl"> = {
  en: "ltr",
  he: "rtl",
};

export const translations = {
  en: {
    // App chrome
    signOut: "Sign out",

    // Currency toggle
    fetchingRate: "Fetching exchange rate…",
    rateNote: "1 {from} ≈ {rate} {to}, for display only",
    rateUnavailable: "Conversion temporarily unavailable — showing {currency}",

    // Login
    loginSubtitleSignup: "Create an account to start forecasting.",
    loginSubtitleSignin: "Sign in to your business.",
    emailLabel: "Email",
    passwordLabel: "Password",
    createAccountButton: "Create account",
    signInButton: "Sign in",
    alreadyHaveAccount: "Already have an account?",
    newToLedgerline: "New to Ledgerline?",
    signInLink: "Sign in",
    createAccountLink: "Create an account",
    errorEnterEmailPassword: "Enter an email and password.",
    infoAccountCreated: "Account created — sign in below.",

    // Dashboard
    yourBusinesses: "Your businesses",
    pickAccountToForecast: "Pick an account to import transactions and run a forecast.",
    addABusiness: "Add a business",
    businessNameLabel: "Business name",
    currencyLabel: "Currency",
    errorAccountNameRequired: "Account name is required",

    // Account page
    forecastsOverviewButton: "Forecasts overview",
    settingsButton: "Settings",
    minimumBufferMeta: "minimum buffer",
    uploadTransactionsHeading: "Upload transactions",
    forecastHeading: "Forecast",
    runForecastButton: "Run forecast",
    runForecastHint: "Run a forecast once you've imported some transactions.",
    forecastBadgeSuffix: "forecast",
    generatedFromStartingBalance: "Generated {date} from a starting balance of",
    transactionsHeading: "Transactions",
    totalSuffix: "total",
    noTransactionsYet: "No transactions yet — upload a CSV above to get started.",
    dateColumn: "Date",
    descriptionColumn: "Description",
    amountColumn: "Amount",
    pageOf: "Page {page} of {total}",
    previous: "Previous",
    next: "Next",
    errorHorizonNeedsDays: "{horizon} forecast needs {days} more day{plural} of transaction history.",

    // Horizon selector
    horizonMonth: "Month",
    horizonQuarter: "Quarter",
    horizonYear: "Year",
    horizonNeedsMoreDays: "Needs {days} more day{plural} of transaction history",
    horizonLowConfidence: "Confidence is lower — under a full year of history",

    // Settings
    settingsBreadcrumb: "Settings",
    accountSettingsHeading: "Account settings",
    settingsSaved: "Settings saved.",
    minimumBufferLabel: "Minimum buffer",
    minimumBufferHelp: "The forecast flags any week that dips below this balance.",
    startingBalanceOverrideLabel: "Starting balance override",
    startingBalanceOverridePlaceholder: "Uses sum of transaction history if left blank",
    saveChangesButton: "Save changes",
    dangerZoneHeading: "Danger zone",
    dangerZoneBody: "Deleting this account permanently removes its transactions and forecasts.",
    deleteAccountButton: "Delete account",

    // Forecasts overview
    forecastsBreadcrumb: "Forecasts",
    forecastsHeading: "Forecasts",
    forecastsSubtitle: "Compare the near-term picture against the longer-term one at a glance.",
    lowerConfidenceBadge: "Lower confidence",
    notEnoughDataYet: "Not enough data yet — needs {days} more day{plural} of transaction history.",
    notRunYetPrefix: "Not run yet.",
    runAForecastLink: "Run a {horizon} forecast",
    fromTheAccountPage: "from the account page.",
    lowPointLabel: "Low point:",
    historyHeading: "History",
    noForecastsYet: "No forecasts have been run yet.",
    horizonColumn: "Horizon",
    generatedColumn: "Generated",
    lowPointColumn: "Low point",

    // CSV upload
    csvDropzone: "Click to choose a CSV of bank transactions",
    csvDateColumn: "Date column",
    csvDescriptionColumn: "Description column",
    csvAmountFormat: "Amount format",
    csvSingleSignedAmount: "Single signed amount",
    csvSeparateDebitCredit: "Separate debit / credit",
    csvDebitColumn: "Debit column",
    csvCreditColumn: "Credit column",
    csvAmountColumn: "Amount column",
    csvChoose: "Choose…",
    csvShowingRows: "Showing the first {shown} of {total} parsed rows.",
    csvImportRows: "Import {count} rows",
    csvImporting: "Importing…",
    csvCancel: "Cancel",
    csvUploadAnother: "Upload another file",
    csvImported: "Imported {count} transaction{plural}.",
    csvSkipped: " Skipped {count} row{plural}.",
    csvRowLabel: "Row {row}: {reason}",
    csvAndMore: "…and {count} more",

    // Forecast chart
    chartProjectedIn: "Projected in",
    chartProjectedOut: "Projected out",
    chartBalance: "Balance",

    // Excel export / import
    exportToExcel: "Export to Excel",
    csvImportHeading: "Import from CSV",
    excelImportHeading: "Import from Excel",
    excelDropzone: "Click to choose an Excel file (.xlsx) to import",
    excelMissingSheet: "This doesn't look like a Ledgerline export — missing the \"{sheet}\" sheet.",
    excelParseError: "Couldn't read that file as an Excel workbook.",
    excelReviewHeading: "Review changes before importing",
    excelNewTransactions: "{count} new transaction{plural}",
    excelUpdatedTransactions: "{count} updated transaction{plural}",
    excelDeletedTransactions: "{count} transaction{plural} will be deleted",
    excelNoTransactionChanges: "No transaction changes detected.",
    excelAccountChangesHeading: "Account setting changes",
    excelNoAccountChanges: "No account setting changes.",
    excelSkippedRowsHeading: "Rows skipped (invalid data)",
    excelConfirmImport: "Confirm import",
    excelImporting: "Importing…",
    excelImportDone: "Import complete: {inserted} added, {updated} updated, {deleted} deleted.",
  },
  he: {
    // App chrome
    signOut: "התנתקות",

    // Currency toggle
    fetchingRate: "טוען שער חליפין…",
    rateNote: "1 {from} ≈ {rate} {to}, לתצוגה בלבד",
    rateUnavailable: "המרה אינה זמינה כרגע — מוצג ב-{currency}",

    // Login
    loginSubtitleSignup: "צור חשבון כדי להתחיל לתחזת תזרים מזומנים.",
    loginSubtitleSignin: "התחבר לעסק שלך.",
    emailLabel: "אימייל",
    passwordLabel: "סיסמה",
    createAccountButton: "צור חשבון",
    signInButton: "התחברות",
    alreadyHaveAccount: "כבר יש לך חשבון?",
    newToLedgerline: "חדש ב-Ledgerline?",
    signInLink: "התחבר",
    createAccountLink: "צור חשבון",
    errorEnterEmailPassword: "יש להזין אימייל וסיסמה.",
    infoAccountCreated: "החשבון נוצר — התחבר למטה.",

    // Dashboard
    yourBusinesses: "העסקים שלך",
    pickAccountToForecast: "בחר עסק כדי לייבא תנועות ולהריץ תחזית.",
    addABusiness: "הוסף עסק",
    businessNameLabel: "שם העסק",
    currencyLabel: "מטבע",
    errorAccountNameRequired: "יש להזין שם עסק",

    // Account page
    forecastsOverviewButton: "סקירת תחזיות",
    settingsButton: "הגדרות",
    minimumBufferMeta: "רזרבה מינימלית",
    uploadTransactionsHeading: "ייבוא תנועות",
    forecastHeading: "תחזית",
    runForecastButton: "הרץ תחזית",
    runForecastHint: "הרץ תחזית לאחר ייבוא תנועות.",
    forecastBadgeSuffix: "תחזית",
    generatedFromStartingBalance: "נוצר ב-{date} מיתרת פתיחה של",
    transactionsHeading: "תנועות",
    totalSuffix: "סה\"כ",
    noTransactionsYet: "עדיין אין תנועות — ייבא קובץ CSV למעלה כדי להתחיל.",
    dateColumn: "תאריך",
    descriptionColumn: "תיאור",
    amountColumn: "סכום",
    pageOf: "עמוד {page} מתוך {total}",
    previous: "הקודם",
    next: "הבא",
    errorHorizonNeedsDays: "תחזית {horizon} דורשת עוד {days} ימי היסטוריה של תנועות.",

    // Horizon selector
    horizonMonth: "חודש",
    horizonQuarter: "רבעון",
    horizonYear: "שנה",
    horizonNeedsMoreDays: "דורש עוד {days} ימי היסטוריה של תנועות",
    horizonLowConfidence: "רמת ביטחון נמוכה יותר — פחות משנה מלאה של היסטוריה",

    // Settings
    settingsBreadcrumb: "הגדרות",
    accountSettingsHeading: "הגדרות עסק",
    settingsSaved: "ההגדרות נשמרו.",
    minimumBufferLabel: "רזרבה מינימלית",
    minimumBufferHelp: "התחזית תסמן כל שבוע שבו היתרה יורדת מתחת לסכום זה.",
    startingBalanceOverrideLabel: "יתרת פתיחה ידנית",
    startingBalanceOverridePlaceholder: "אם ריק, ישתמש בסכום ההיסטוריה של התנועות",
    saveChangesButton: "שמור שינויים",
    dangerZoneHeading: "אזור מסוכן",
    dangerZoneBody: "מחיקת העסק תמחק לצמיתות את התנועות והתחזיות שלו.",
    deleteAccountButton: "מחק עסק",

    // Forecasts overview
    forecastsBreadcrumb: "תחזיות",
    forecastsHeading: "תחזיות",
    forecastsSubtitle: "השווה במבט אחד בין התמונה הקרובה לתמונה הרחוקה יותר.",
    lowerConfidenceBadge: "ביטחון נמוך יותר",
    notEnoughDataYet: "עדיין אין מספיק נתונים — דורש עוד {days} ימי היסטוריה של תנועות.",
    notRunYetPrefix: "עדיין לא הורצה.",
    runAForecastLink: "הרץ תחזית {horizon}",
    fromTheAccountPage: "מדף העסק.",
    lowPointLabel: "נקודה נמוכה:",
    historyHeading: "היסטוריה",
    noForecastsYet: "עדיין לא הורצו תחזיות.",
    horizonColumn: "טווח",
    generatedColumn: "נוצר",
    lowPointColumn: "נקודה נמוכה",

    // CSV upload
    csvDropzone: "לחץ כדי לבחור קובץ CSV של תנועות בנק",
    csvDateColumn: "עמודת תאריך",
    csvDescriptionColumn: "עמודת תיאור",
    csvAmountFormat: "פורמט סכום",
    csvSingleSignedAmount: "סכום חתום יחיד",
    csvSeparateDebitCredit: "חובה / זכות נפרדים",
    csvDebitColumn: "עמודת חובה",
    csvCreditColumn: "עמודת זכות",
    csvAmountColumn: "עמודת סכום",
    csvChoose: "בחר…",
    csvShowingRows: "מוצגות {shown} מתוך {total} השורות שנותחו.",
    csvImportRows: "ייבא {count} שורות",
    csvImporting: "מייבא…",
    csvCancel: "ביטול",
    csvUploadAnother: "העלה קובץ נוסף",
    csvImported: "יובאו {count} תנועות.",
    csvSkipped: " דולגו {count} שורות.",
    csvRowLabel: "שורה {row}: {reason}",
    csvAndMore: "…ועוד {count}",

    // Forecast chart
    chartProjectedIn: "צפי הכנסות",
    chartProjectedOut: "צפי הוצאות",
    chartBalance: "יתרה",

    // Excel export / import
    exportToExcel: "ייצוא ל-Excel",
    csvImportHeading: "ייבוא מקובץ CSV",
    excelImportHeading: "ייבוא מקובץ Excel",
    excelDropzone: "לחץ כדי לבחור קובץ Excel (.xlsx) לייבוא",
    excelMissingSheet: "הקובץ אינו נראה כמו ייצוא של Ledgerline — חסר הגיליון \"{sheet}\".",
    excelParseError: "לא ניתן היה לקרוא את הקובץ כקובץ Excel.",
    excelReviewHeading: "בדוק את השינויים לפני הייבוא",
    excelNewTransactions: "{count} תנועות חדשות",
    excelUpdatedTransactions: "{count} תנועות עודכנו",
    excelDeletedTransactions: "{count} תנועות יימחקו",
    excelNoTransactionChanges: "לא זוהו שינויים בתנועות.",
    excelAccountChangesHeading: "שינויים בהגדרות העסק",
    excelNoAccountChanges: "אין שינויים בהגדרות העסק.",
    excelSkippedRowsHeading: "שורות שדולגו (נתונים לא תקינים)",
    excelConfirmImport: "אשר ייבוא",
    excelImporting: "מייבא…",
    excelImportDone: "הייבוא הושלם: {inserted} נוספו, {updated} עודכנו, {deleted} נמחקו.",
  },
} satisfies Record<Locale, Record<string, string>>;

export type TranslationKey = keyof typeof translations.en;

/** Substitutes `{name}` placeholders in a translated string with `vars[name]`. */
export function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}

/** English pluralizes with a trailing "s"; the Hebrew strings above are already phrased to need no suffix. */
export function pluralS(n: number, locale: Locale): string {
  return locale === "en" && n !== 1 ? "s" : "";
}

/** Reads the `locale` field a form submits via `<LocaleHiddenInput />`, defaulting to English. */
export function parseLocaleFormField(value: FormDataEntryValue | null): Locale {
  return value === "he" ? "he" : "en";
}
