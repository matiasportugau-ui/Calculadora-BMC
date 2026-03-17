#!/usr/bin/env python3
"""Billing error checker for admin exports.

Reads CSV/XLS/XLSX, normalizes columns, applies validation rules,
and writes:
- JSON report (summary + findings + recommended actions)
- CSV findings (row-level)
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Dict, List, Optional

import pandas as pd


ALIASES: Dict[str, List[str]] = {
    "tipo": ["tipo", "tipo cfe", "tipo doc", "comprobante", "document type"],
    "serie": ["serie", "serie doc", "branch"],
    "numero": ["numero", "nro", "nro doc", "invoice number", "dnro"],
    "fecha": ["fecha", "fecha emision", "issue date", "fecha comprobante"],
    "rut_cliente": ["rut", "ruc", "rut cliente", "customer tax id"],
    "neto": ["neto", "subtotal", "taxable amount", "monto neto"],
    "impuesto": ["iva", "tax", "monto iva", "impuesto"],
    "total": ["total", "amount total", "importe total"],
    "estado_pago": ["estado", "payment status", "pagado", "estado pago"],
    "fecha_pago": ["fecha pago", "payment date", "fecha cobro"],
    "referencia_pago": ["ref pago", "payment ref", "comprobante pago"],
}

REQUIRED_FIELDS = ["tipo", "numero", "fecha", "neto", "impuesto", "total"]
PAID_STATES = {"paid", "pagado", "cobrado", "cancelado"}
CN_PATTERNS = ("nc", "nota de credito", "credit note")


def normalize_name(value: str) -> str:
    return re.sub(r"\s+", " ", str(value).strip().lower())


def detect_column(df: pd.DataFrame, aliases: List[str]) -> Optional[str]:
    by_normalized = {normalize_name(col): col for col in df.columns}

    for alias in aliases:
        alias_norm = normalize_name(alias)
        if alias_norm in by_normalized:
            return by_normalized[alias_norm]

    for alias in aliases:
        alias_norm = normalize_name(alias)
        for norm_col, original_col in by_normalized.items():
            if alias_norm in norm_col:
                return original_col
    return None


def read_table(path: Path) -> pd.DataFrame:
    suffix = path.suffix.lower()
    if suffix == ".csv":
        return pd.read_csv(path)
    if suffix in {".xls", ".xlsx"}:
        raw = pd.read_excel(path, header=None)
        header_idx: Optional[int] = None
        for idx in range(min(30, len(raw))):
            row = [normalize_name(x) for x in raw.iloc[idx].tolist()]
            if "fecha comprobante" in row or "invoice number" in row:
                header_idx = idx
                break
        if header_idx is None:
            return pd.read_excel(path)
        header = raw.iloc[header_idx].tolist()
        data = raw.iloc[header_idx + 1 :].copy()
        data.columns = header
        data = data.dropna(how="all")
        return data.reset_index(drop=True)
    raise ValueError(f"Unsupported format: {path}")


def normalize_df(df: pd.DataFrame) -> pd.DataFrame:
    rows = len(df)
    mapped: Dict[str, pd.Series] = {}
    for target, alias_list in ALIASES.items():
        source = detect_column(df, alias_list)
        if source:
            mapped[target] = df[source]
        else:
            mapped[target] = pd.Series([pd.NA] * rows)

    out = pd.DataFrame(mapped)
    out["tipo"] = out["tipo"].astype(str).str.strip().str.lower()
    out["serie"] = out["serie"].astype(str).str.strip()
    out["numero"] = out["numero"].astype(str).str.strip()
    out["rut_cliente"] = out["rut_cliente"].astype(str).str.strip()
    out["estado_pago"] = out["estado_pago"].astype(str).str.strip().str.lower()
    out["referencia_pago"] = out["referencia_pago"].astype(str).str.strip()
    out["fecha"] = pd.to_datetime(out["fecha"], errors="coerce")
    out["fecha_pago"] = pd.to_datetime(out["fecha_pago"], errors="coerce")

    for money_col in ["neto", "impuesto", "total"]:
        out[money_col] = pd.to_numeric(out[money_col], errors="coerce")

    out["doc_key"] = out["tipo"] + "|" + out["serie"] + "|" + out["numero"]
    out["row_number"] = out.index + 2
    return out


def build_finding(
    row: pd.Series,
    error_type: str,
    severity: str,
    message: str,
    suggested_fix: str,
) -> Dict[str, object]:
    return {
        "row_number": int(row["row_number"]),
        "doc_key": str(row.get("doc_key", "")),
        "error_type": error_type,
        "severity": severity,
        "message": message,
        "suggested_fix": suggested_fix,
    }


def validate_required_fields(df: pd.DataFrame) -> List[Dict[str, object]]:
    findings: List[Dict[str, object]] = []
    for _, row in df.iterrows():
        for field in REQUIRED_FIELDS:
            value = row.get(field)
            if pd.isna(value) or str(value).strip() in {"", "nan", "NaT"}:
                severity = "high" if field in {"tipo", "numero", "fecha"} else "medium"
                findings.append(
                    build_finding(
                        row=row,
                        error_type="missing_required_field",
                        severity=severity,
                        message=f"Missing required field: {field}",
                        suggested_fix="Complete mandatory value in source system.",
                    )
                )
    return findings


def validate_duplicates(df: pd.DataFrame) -> List[Dict[str, object]]:
    findings: List[Dict[str, object]] = []
    dup_mask = df["doc_key"].duplicated(keep=False)
    duplicated_rows = df[dup_mask]
    for _, row in duplicated_rows.iterrows():
        findings.append(
            build_finding(
                row=row,
                error_type="duplicate_document_key",
                severity="critical",
                message="Document key appears more than once.",
                suggested_fix="Keep one valid row and reconcile duplicates.",
            )
        )
    return findings


def validate_tax_math(
    df: pd.DataFrame,
    tolerance: float,
) -> List[Dict[str, object]]:
    findings: List[Dict[str, object]] = []
    for _, row in df.iterrows():
        neto = row.get("neto")
        imp = row.get("impuesto")
        total = row.get("total")
        if pd.isna(neto) or pd.isna(imp) or pd.isna(total):
            continue
        diff = abs((float(neto) + float(imp)) - float(total))
        if diff > tolerance:
            findings.append(
                build_finding(
                    row=row,
                    error_type="tax_math_mismatch",
                    severity="critical",
                    message=f"Tax math mismatch. Difference: {diff:.2f}",
                    suggested_fix="Correct net/tax/total consistency.",
                )
            )
    return findings


def validate_credit_notes(df: pd.DataFrame) -> List[Dict[str, object]]:
    findings: List[Dict[str, object]] = []
    for _, row in df.iterrows():
        tipo = str(row.get("tipo", "")).lower()
        if not any(pattern in tipo for pattern in CN_PATTERNS):
            continue
        total = row.get("total")
        if pd.notna(total) and float(total) > 0:
            findings.append(
                build_finding(
                    row=row,
                    error_type="credit_note_positive_total",
                    severity="medium",
                    message="Credit note has positive total.",
                    suggested_fix="Verify sign and link to origin invoice.",
                )
            )
    return findings


def validate_period(df: pd.DataFrame, period: Optional[str]) -> List[Dict[str, object]]:
    findings: List[Dict[str, object]] = []
    if not period:
        return findings
    if not re.match(r"^\d{4}-\d{2}$", period):
        raise ValueError("--period must use YYYY-MM format")
    year, month = map(int, period.split("-"))

    for _, row in df.iterrows():
        date_value = row.get("fecha")
        if pd.isna(date_value):
            continue
        if int(date_value.year) != year or int(date_value.month) != month:
            findings.append(
                build_finding(
                    row=row,
                    error_type="period_cutoff_mismatch",
                    severity="high",
                    message=f"Document date outside target period {period}.",
                    suggested_fix="Review posting period before close.",
                )
            )
    return findings


def validate_payment_status(df: pd.DataFrame) -> List[Dict[str, object]]:
    findings: List[Dict[str, object]] = []
    for _, row in df.iterrows():
        state = str(row.get("estado_pago", "")).strip().lower()
        if state not in PAID_STATES:
            continue
        payment_date = row.get("fecha_pago")
        payment_ref = str(row.get("referencia_pago", "")).strip()
        if pd.isna(payment_date) and payment_ref == "":
            findings.append(
                build_finding(
                    row=row,
                    error_type="payment_status_contradiction",
                    severity="medium",
                    message="Marked paid without date/reference evidence.",
                    suggested_fix="Add payment support or adjust status.",
                )
            )
    return findings


def summarize_findings(findings: List[Dict[str, object]]) -> Dict[str, object]:
    by_severity: Dict[str, int] = {}
    by_error_type: Dict[str, int] = {}
    for item in findings:
        sev = str(item["severity"])
        err = str(item["error_type"])
        by_severity[sev] = by_severity.get(sev, 0) + 1
        by_error_type[err] = by_error_type.get(err, 0) + 1

    top_risk = sorted(
        by_error_type.items(),
        key=lambda kv: kv[1],
        reverse=True,
    )[:5]
    return {
        "findings_by_severity": by_severity,
        "findings_by_error_type": by_error_type,
        "top_risk_drivers": top_risk,
    }


def build_actions(summary: Dict[str, object]) -> Dict[str, List[str]]:
    sev = summary.get("findings_by_severity", {})
    critical = int(sev.get("critical", 0))
    high = int(sev.get("high", 0))

    today = [
        "Resolve duplicate documents and tax math mismatches.",
        "Freeze critical documents until corrected.",
    ]
    week = [
        "Fix out-of-period and missing required fields.",
        "Validate credit notes against origin invoices.",
    ]
    close = [
        "Review recurring medium/low issues and update SOP.",
        "Run this checker before every monthly close.",
    ]

    if critical == 0:
        today = ["No critical findings detected. Focus on high severity items."]
    if high == 0:
        week = ["No high findings detected. Monitor medium issues."]

    return {"today": today, "this_week": week, "month_close": close}


def run_checks(
    df: pd.DataFrame,
    period: Optional[str],
    tolerance: float,
) -> List[Dict[str, object]]:
    findings: List[Dict[str, object]] = []
    findings.extend(validate_required_fields(df))
    findings.extend(validate_duplicates(df))
    findings.extend(validate_tax_math(df, tolerance=tolerance))
    findings.extend(validate_credit_notes(df))
    findings.extend(validate_period(df, period=period))
    findings.extend(validate_payment_status(df))
    return findings


def main() -> None:
    parser = argparse.ArgumentParser(description="Check possible billing errors.")
    parser.add_argument("--input", required=True, help="Input CSV/XLS/XLSX file.")
    parser.add_argument("--period", default=None, help="Target period YYYY-MM.")
    parser.add_argument(
        "--tolerance",
        type=float,
        default=2.0,
        help="Tolerance for tax math mismatch.",
    )
    parser.add_argument(
        "--out-json",
        default="billing_error_report.json",
        help="Output JSON report path.",
    )
    parser.add_argument(
        "--out-csv",
        default="billing_error_findings.csv",
        help="Output CSV findings path.",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    raw = read_table(input_path)
    normalized = normalize_df(raw)
    findings = run_checks(
        df=normalized,
        period=args.period,
        tolerance=args.tolerance,
    )
    summary = summarize_findings(findings)
    actions = build_actions(summary)

    report = {
        "meta": {
            "input_file": str(input_path),
            "rows_analyzed": int(len(normalized)),
            "period": args.period,
            "tolerance": args.tolerance,
        },
        "diagnostico_rapido": {
            "total_hallazgos": int(len(findings)),
            **summary,
        },
        "hallazgos": findings,
        "acciones_recomendadas": actions,
    }

    out_json = Path(args.out_json)
    out_json.write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    findings_df = pd.DataFrame(findings)
    out_csv = Path(args.out_csv)
    findings_df.to_csv(out_csv, index=False, encoding="utf-8")

    print("Billing review completed")
    print(f"JSON: {out_json.resolve()}")
    print(f"CSV:  {out_csv.resolve()}")
    print(f"Findings: {len(findings)}")


if __name__ == "__main__":
    main()
