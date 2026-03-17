#!/usr/bin/env python3
"""Extrae CFE desde sobres XML y genera CSV por mes.

Uso:
  python3 extraer_cfe_mensual.py \
    --base-dir "/Users/matias/Downloads/DGI /datosEmisor1368864daoadiccdo" \
    --year 2024 \
    --out-dir "/Users/matias/Downloads/DGI /export_mensual_2024"
"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path
from typing import Dict, Iterable, List, Optional
from xml.etree import ElementTree as ET

import pandas as pd


def _tag_name(tag: str) -> str:
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag


def _find_text_any(root: ET.Element, names: Iterable[str]) -> Optional[str]:
    wanted = set(names)
    for el in root.iter():
        if _tag_name(el.tag) in wanted and el.text is not None:
            value = el.text.strip()
            if value:
                return value
    return None


def _parse_amount(raw: Optional[str]) -> float:
    if not raw:
        return 0.0
    value = raw.strip().replace(",", ".")
    if value.startswith("."):
        value = f"0{value}"
    try:
        return float(value)
    except ValueError:
        return 0.0


def parse_cfe_xml(path: Path) -> Optional[Dict[str, object]]:
    try:
        tree = ET.parse(path)
    except (ET.ParseError, OSError, ValueError):
        return None
    root = tree.getroot()

    fecha = _find_text_any(root, ["FchEmis"])
    tipo = _find_text_any(root, ["TipoCFE"])
    serie = _find_text_any(root, ["Serie"]) or ""
    numero = _find_text_any(root, ["Nro", "DNro"]) or ""
    rut_emisor = _find_text_any(root, ["RUCEmisor"]) or ""
    rut_receptor = _find_text_any(root, ["DocRecep", "RutReceptor"]) or ""

    neto = _parse_amount(_find_text_any(root, ["MntNetoIVATasaBasica"]))
    neto += _parse_amount(_find_text_any(root, ["MntNetoIvaTasaMin"]))
    neto += _parse_amount(_find_text_any(root, ["MntNetoIVAOtra"]))

    iva = _parse_amount(_find_text_any(root, ["MntIVATasaBasica"]))
    iva += _parse_amount(_find_text_any(root, ["MntIVATasaMin"]))
    iva += _parse_amount(_find_text_any(root, ["MntIVAOtra"]))

    total = _parse_amount(_find_text_any(root, ["MntTotal"]))

    if not fecha or not tipo:
        return None

    return {
        "fecha": fecha,
        "tipo": str(tipo).strip(),
        "serie": str(serie).strip(),
        "numero": str(numero).strip(),
        "rut_emisor": str(rut_emisor).strip(),
        "rut_receptor": str(rut_receptor).strip(),
        "neto": neto,
        "iva": iva,
        "total": total,
        "source_file": str(path),
    }


def process_folder(folder: Path, year: int) -> Dict[str, List[Dict[str, object]]]:
    grouped: Dict[str, List[Dict[str, object]]] = defaultdict(list)
    for xml_path in sorted(folder.glob("*.xml")):
        row = parse_cfe_xml(xml_path)
        if not row:
            continue
        fecha = pd.to_datetime(row["fecha"], errors="coerce")
        if pd.isna(fecha) or int(fecha.year) != year:
            continue
        month_key = f"{fecha.year:04d}-{fecha.month:02d}"
        row["fecha"] = fecha.strftime("%Y-%m-%d")
        grouped[month_key].append(row)
    return grouped


def write_monthly_csv(
    grouped: Dict[str, List[Dict[str, object]]], output_dir: Path, prefix: str
) -> Dict[str, Dict[str, object]]:
    output_dir.mkdir(parents=True, exist_ok=True)
    stats: Dict[str, Dict[str, object]] = {}
    for month in sorted(grouped.keys()):
        rows = grouped[month]
        df = pd.DataFrame(rows)
        file_path = output_dir / f"{prefix}_{month}.csv"
        df.to_csv(file_path, index=False, encoding="utf-8")
        stats[month] = {
            "rows": int(len(df)),
            "neto": float(df["neto"].sum()) if "neto" in df else 0.0,
            "iva": float(df["iva"].sum()) if "iva" in df else 0.0,
            "total": float(df["total"].sum()) if "total" in df else 0.0,
            "file": str(file_path),
        }
    return stats


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extrae CFE XML mes a mes"
    )
    parser.add_argument(
        "--base-dir",
        required=True,
        help="Carpeta datosEmisor... de DGI",
    )
    parser.add_argument("--year", type=int, required=True, help="Anio objetivo (ej. 2024)")
    parser.add_argument(
        "--out-dir",
        required=True,
        help="Carpeta de salida (se crean subcarpetas emitidos y recibidos)",
    )
    args = parser.parse_args()

    base_dir = Path(args.base_dir)
    out_dir = Path(args.out_dir)
    emitidos_dir = base_dir / "sobresEmitidos"
    recibidos_dir = base_dir / "sobresRecibidos"

    if not emitidos_dir.exists():
        raise FileNotFoundError(f"No existe: {emitidos_dir}")
    if not recibidos_dir.exists():
        raise FileNotFoundError(f"No existe: {recibidos_dir}")

    emitidos_grouped = process_folder(emitidos_dir, args.year)
    recibidos_grouped = process_folder(recibidos_dir, args.year)

    emitidos_stats = write_monthly_csv(
        emitidos_grouped, out_dir / "emitidos", "emitidos"
    )
    recibidos_stats = write_monthly_csv(
        recibidos_grouped, out_dir / "recibidos", "recibidos"
    )

    summary = {
        "year": args.year,
        "base_dir": str(base_dir),
        "output_dir": str(out_dir),
        "emitidos": emitidos_stats,
        "recibidos": recibidos_stats,
    }
    summary_path = out_dir / f"resumen_{args.year}.json"
    summary_path.write_text(
        json.dumps(summary, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print("Extraccion mensual completada")
    print(f"Salida: {out_dir.resolve()}")
    print(f"Resumen: {summary_path.resolve()}")


if __name__ == "__main__":
    main()
