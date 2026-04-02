#!/usr/bin/env bash
# iCloud Drive: ver cuota, estado de sync y (opcional) liberar disco evictando
# copias locales de rutas ya subidas a iCloud. No borra la nube.
#
# Uso:
#   bash scripts/icloud-free-local-space.sh              # resumen + tamaños en CloudDocs
#   bash scripts/icloud-free-local-space.sh status       # brctl status (pendientes)
#   I_CLOUD_EVICT_CONFIRM=1 bash scripts/icloud-free-local-space.sh evict "/ruta/dentro/de/iCloud"
#
# Antes de evict: en Finder, confirmá que iCloud terminó de subir (sin iconos de carga).
# Después de evict: los ítems siguen en iCloud; al abrirlos se vuelven a bajar (necesitás red).
#
# Ver también: Ajustes → [tu nombre] → iCloud → iCloud Drive → Escritorio y Documentos;
# Fotos → Ajustes → Almacenamiento del Mac optimizado.

set -euo pipefail

ICLOUD_DOCS="${ICLOUD_DOCS:-$HOME/Library/Mobile Documents/com~apple~CloudDocs}"

cmd="${1:-summary}"

echo "=== iCloud / espacio local (solo brctl + du; evict solo con I_CLOUD_EVICT_CONFIRM=1) ==="
echo "CloudDocs (Finder «iCloud Drive»): $ICLOUD_DOCS"
echo

if [[ ! -d "$ICLOUD_DOCS" ]]; then
  echo "No existe la carpeta CloudDocs en la ruta esperada. ¿Estás con otra cuenta o sin iCloud Drive?"
  exit 1
fi

case "$cmd" in
  summary)
    echo "--- brctl quota (cuenta activa) ---"
    brctl quota 2>/dev/null || echo "(brctl quota no disponible o sin sesión iCloud)"
    echo
    echo "--- Tamaño local por carpeta de primer nivel en iCloud Drive ---"
    du -sh "$ICLOUD_DOCS"/* 2>/dev/null | sort -hr | head -40
    echo
    echo "Siguiente: revisá 'status' o evict de una subcarpeta concreta (ver cabecera del script)."
    ;;
  status)
    echo "--- brctl status (ítems con sync pendiente / aplicación a disco) ---"
    brctl status 2>/dev/null | head -200 || true
    echo
    echo "Si hay muchas líneas de error o pendientes, esperá a que termine la subida antes de evict."
    ;;
  evict)
    target="${2:-}"
    if [[ -z "$target" ]]; then
      echo "Uso: I_CLOUD_EVICT_CONFIRM=1 $0 evict \"/ruta/completa/o/bajo/CloudDocs/subcarpeta\""
      exit 1
    fi
    if [[ "${I_CLOUD_EVICT_CONFIRM:-}" != "1" ]]; then
      echo "Evicción NO ejecutada. Para ejecutar: I_CLOUD_EVICT_CONFIRM=1 $0 evict \"$target\""
      exit 1
    fi
    if [[ ! -e "$target" ]]; then
      echo "No existe: $target"
      exit 1
    fi
    # Resolver a ruta absoluta
    target="$(cd "$(dirname "$target")" && pwd)/$(basename "$target")"
    case "$target" in
      "$ICLOUD_DOCS"/*) ;;
      *)
        echo "Solo se permite evict bajo CloudDocs: $ICLOUD_DOCS"
        echo "Ruta recibida: $target"
        exit 1
        ;;
    esac
    echo "Evict recursivo (archivos) bajo: $target"
    count=0
    while IFS= read -r -d '' f; do
      brctl evict "$f" 2>/dev/null && count=$((count + 1)) || true
    done < <(find "$target" -type f -print0 2>/dev/null)
    echo "Hecho: brctl evict intentado en $count archivos (algunos pueden ignorarse si no son CloudDocs)."
    ;;
  accounts)
    brctl accounts -w 2>/dev/null || brctl accounts 2>/dev/null || true
    ;;
  *)
    echo "Comando desconocido: $cmd (summary | status | evict | accounts)"
    exit 1
    ;;
esac
