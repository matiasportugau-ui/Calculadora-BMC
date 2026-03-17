#!/usr/bin/env python3
"""Conciliacion basica de CFE para analisis impositivo.

Uso rapido:
  python3 conciliar_cfe.py \
    --cfe-emitidos dgi_emitidos.xlsx \
    --cfe-recibidos dgi_recibidos.xlsx \
    --periodo 2024-12 \
    --out reporte_conciliacion.json

Notas:
- Soporta CSV/XLS/XLSX.
- Intenta mapear columnas por nombre (tolerante a variaciones comunes).
- Entrega un resumen util para detectar diferencias de IVA.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Dict, List, Optional

import pandas as pd


COLUMN_ALIASES = {
    "fecha": ["fecha", "fecha cfe", "fec emision", "fecha emision", "fecha comprobante"],
    "tipo": ["tipo", "tipo cfe", "tipocfe", "comprobante", "tipo comprobante"],
    "serie": ["serie"],
    "numero": ["numero", "nro", "nro cfe", "numero cfe", "dnro"],
    "rut_emisor": ["rut emisor", "ruc emisor", "ruc e", "emisor"],
    "rut_receptor": ["rut receptor", "ruc receptor", "ruc r", "receptor"],
    "neto": ["neto", "monto neto", "gravado", "importe neto"],
    "iva": ["iva", "monto iva", "impuesto iva", "iva ventas"],
    "total": ["total", "monto total", "importe total"],
}


def normalize_colname(name: str) -> str:
    return re.sub(r"\s+", " ", str(name).strip().lower())


def detect_column(df: pd.DataFrame, aliases: List[str]) -> Optional[str]:
    cols = {normalize_colname(c): c for c in df.columns}
    for alias in aliases:
        if alias in cols:
            return cols[alias]
    for alias in aliases:
        for normalized, original in cols.items():
            if alias in normalized:
                return original
    return None


def map_columns(df: pd.DataFrame) -> pd.DataFrame:
    mapped = {}
    nrows = len(df)
    for target, aliases in COLUMN_ALIASES.items():
        found = detect_column(df, aliases)
        if found:
            mapped[target] = df[found]
        else:
            mapped[target] = pd.Series([pd.NA] * nrows)
    out = pd.DataFrame(mapped)
    # Parse dates for Uruguayan DGI: DD/MM/YYYY primary. dayfirst=True handles both
    # DD/MM/YYYY and YYYY-MM-DD; never use dayfirst=False as fallback (would misparse
    # e.g. "05/03/2024" as May 3 instead of March 5).
    out["fecha"] = pd.to_datetime(out["fecha"], errors="coerce", dayfirst=True)
    for money_col in ["neto", "iva", "total"]:
        out[money_col] = pd.to_numeric(out[money_col], errors="coerce").fillna(0.0)
    out["tipo"] = out["tipo"].astype(str).str.strip().str.lower()
    out["serie"] = out["serie"].astype(str).str.strip()
    out["numero"] = out["numero"].astype(str).str.strip()
    out["doc_key"] = out["tipo"] + "|" + out["serie"] + "|" + out["numero"]
    return out


def read_table(path: Path) -> pd.DataFrame:
    suffix = path.suffix.lower()
    if suffix == ".csv":
        return pd.read_csv(path)
    if suffix in {".xls", ".xlsx"}:
        # Some DGI exports include metadata rows before the real header.
        raw = pd.read_excel(path, header=None)
        header_idx: Optional[int] = None
        for i in range(min(30, len(raw))):
            row = [normalize_colname(x) for x in raw.iloc[i].tolist()]
            if ("fecha comprobante" in row and "tipo cfe" in row) or (
                "monto neto" in row and "monto total" in row
            ):
                header_idx = i
                break
        if header_idx is not None:
            header = raw.iloc[header_idx].tolist()
            data = raw.iloc[header_idx + 1 :].copy()
            data.columns = header
            data = data.dropna(how="all")
            return data.reset_index(drop=True)
        return pd.read_excel(path)
    raise ValueError(f"Formato no soportado: {path}")


def filter_period(df: pd.DataFrame, period: Optional[str]) -> pd.DataFrame:
    if not period:
        return df
    # formato esperado YYYY-MM
    if not re.match(r"^\d{4}-\d{2}$", period):
        raise ValueError("--periodo debe tener formato YYYY-MM")
    year, month = map(int, period.split("-"))
    return df[(df["fecha"].dt.year == year) & (df["fecha"].dt.month == month)]


def summarize(df: pd.DataFrame, label: str) -> Dict[str, float]:
    return {
        "label": label,
        "rows": int(len(df)),
        "neto": float(df["neto"].sum()),
        "iva": float(df["iva"].sum()),
        "total": float(df["total"].sum()),
    }


def build_output(
    emitidos: Optional[pd.DataFrame],
    recibidos: Optional[pd.DataFrame],
    facturacion: Optional[pd.DataFrame],
) -> Dict:
    result: Dict = {"resumen": {}, "diferencias": {}, "observaciones": []}

    if emitidos is not None:
        result["resumen"]["emitidos_dgi"] = summarize(emitidos, "emitidos_dgi")
    if recibidos is not None:
        result["resumen"]["recibidos_dgi"] = summarize(recibidos, "recibidos_dgi")

    if emitidos is not None and recibidos is not None:
        iva_debito = float(emitidos["iva"].sum())
        iva_credito = float(recibidos["iva"].sum())
        result["resumen"]["saldo_iva_dgi"] = {
            "formula": "iva_debito - iva_credito",
            "iva_debito": iva_debito,
            "iva_credito": iva_credito,
            "saldo": iva_debito - iva_credito,
        }

    if facturacion is not None:
        result["resumen"]["facturacion_interna"] = summarize(facturacion, "facturacion_interna")

    if emitidos is not None and facturacion is not None:
        key_dgi = set(emitidos["doc_key"].dropna().astype(str).tolist())
        key_int = set(facturacion["doc_key"].dropna().astype(str).tolist())
        only_dgi = sorted(key_dgi - key_int)
        only_internal = sorted(key_int - key_dgi)
        result["diferencias"]["solo_dgi"] = only_dgi[:200]
        result["diferencias"]["solo_interno"] = only_internal[:200]
        result["diferencias"]["conteo_solo_dgi"] = len(only_dgi)
        result["diferencias"]["conteo_solo_interno"] = len(only_internal)

        if len(only_dgi) > 0:
            result["observaciones"].append(
                "Hay comprobantes presentes en DGI y ausentes en facturacion interna."
            )
        if len(only_internal) > 0:
            result["observaciones"].append(
                "Hay comprobantes presentes en facturacion interna y ausentes en DGI."
            )

    if not result["observaciones"]:
        result["observaciones"].append("Sin diferencias estructurales detectadas en este corte.")

    return result


def load_and_prepare(path: Optional[str], period: Optional[str]) -> Optional[pd.DataFrame]:
    if not path:
        return None
    df = read_table(Path(path))
    mapped = map_columns(df)
    return filter_period(mapped, period)


def main() -> None:
    parser = argparse.ArgumentParser(description="Conciliacion basica de CFE")
    parser.add_argument("--cfe-emitidos", help="Ruta CFE emitidos DGI (csv/xls/xlsx)")
    parser.add_argument("--cfe-recibidos", help="Ruta CFE recibidos DGI (csv/xls/xlsx)")
    parser.add_argument("--facturacion", help="Ruta export interno facturacion (csv/xls/xlsx)")
    parser.add_argument("--periodo", help="Periodo YYYY-MM", default=None)
    parser.add_argument("--out", help="Ruta salida JSON", default="conciliacion_cfe_output.json")
    args = parser.parse_args()

    emitidos = load_and_prepare(args.cfe_emitidos, args.periodo)
    recibidos = load_and_prepare(args.cfe_recibidos, args.periodo)
    facturacion = load_and_prepare(args.facturacion, args.periodo)

    result = build_output(emitidos, recibidos, facturacion)
    out_path = Path(args.out)
    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    print("Conciliacion completada")
    print(f"Salida: {out_path.resolve()}")
    if "saldo_iva_dgi" in result.get("resumen", {}):
        saldo = result["resumen"]["saldo_iva_dgi"]["saldo"]
        print(f"Saldo IVA DGI (debito - credito): {saldo:,.2f}")


if __name__ == "__main__":
    main()
