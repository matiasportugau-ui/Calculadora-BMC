# Autocarga multi-cliente — análisis alineado 2026-08-09

**Planilla:** Ventas gid `926747636` · **22** candidatos operativos  
**Método:** descarga real Drive/Dropbox → `pdftotext` → `parseLogisticaFromAdjuntoText` + free-text `encargoPlain`.

## Stack

| Layer | Status |
|-------|--------|
| Proxy + dual token (`VITE_API_AUTH_TOKEN`) | **Shipped** #955 |
| CSP connect-src Drive/Dropbox | **Shipped** #953 |
| Parser multi-format (this change) | **This PR** |

## Ground truth (post-parser)

| Cliente | Esperado | Post-parser |
|---------|----------|-------------|
| Alvaro #1345381 | 10× ISODEC 100 | 10× ISODEC 100 L6 |
| Petinho #1344059 | 11+5 ISOPANEL 100 + 6 ISODEC 100 | sum=22 + goteros |
| Eduardo #1345380 | 8× ISODEC 100 L3 | 8× + goteros |
| Daniel Franco | 3× ISOPANEL 50 | 3× |
| Abril | 8× ISOROOF 80 | 8× |
| Free-text goteros/tortugas/perfiles | qty correct | OK |
| Classic accessory-only (Caraballo/UAM) | goteros/perfiles | OK |
| Nario narrativo 2022 / Lucia caballete | often empty | GAP → manual/Admin |

## Parser rules

1. Modern: `ISODEC 100mm · 10 paneles` → qty phrase, default L=6
2. Classic: after mm, pair (largo 1.5–14.5, qty 1–200), ignore prices
3. No ghost qty=1 on titles without qty signal
4. Skip Alcance / N Zonas blurbs
5. Accessories: vocab + qty; reject CONTACTO/FLETE/tel/SALDOS
6. Free-text ENCARGO: `2 Gotero…`, `10 Tortugas…`, `3 paneles Isoroof 30 mm`

## Ops success criteria

- Alvaro: 10× ISODEC, no Failed to fetch (proxy #955)
- Petinho: ~22 panels not qty=1
- No planilla noise as accessories

