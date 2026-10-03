# Workflow — moderación de comentarios Facebook (Bmcuruguay)

Objetivo: ocultar comentarios ofensivos de un autor (caso: **Fernando Guglielmelly**), bloquearlo y reducir que cualquiera deje mensajes en publicaciones.

## A) Automático (Graph API) — preferido

### Requisitos

| Variable | Uso |
|----------|-----|
| `FB_PAGE_TOKEN` | Page token con `pages_read_engagement` + `pages_manage_engagement` (+ permiso de bloqueo de página) |
| `META_PAGE_ID` | ID de la Página Bmcuruguay |

### Comandos

```bash
# 1) Dry-run: lista comentarios del autor (no cambia nada)
FB_PAGE_TOKEN='…' META_PAGE_ID='…' \
  node scripts/meta-moderate-comments.mjs

# 2) Ocultar todos los matches
FB_PAGE_TOKEN='…' META_PAGE_ID='…' \
  node scripts/meta-moderate-comments.mjs --apply

# 3) Ocultar + bloquear autor(es) encontrados
FB_PAGE_TOKEN='…' META_PAGE_ID='…' \
  node scripts/meta-moderate-comments.mjs --apply --block
```

Filtro de autor (opcional):

```bash
META_MODERATE_AUTHOR='Fernando Guglielmelly' \
  node scripts/meta-moderate-comments.mjs --apply --block
```

npm shortcut:

```bash
npm run meta:moderate:comments -- --apply --block
```

El script registra cada match en `data/meta-comments/registry.jsonl` (gitignored) y escribe el último reporte en `data/meta-comments/last-report.json`.

- El nombre se compara sin importar mayúsculas, acentos ni espacios extra (`FERNANDO`, `Fernando`, `Fernándo`).
- Cuando un autor ya está en el ledger, los comentarios nuevos de ese `authorId` también se registran aunque cambie el nombre visible.
- Un scan más corto no borra filas ya registradas.
- Si Graph informa `summary.total_count` mayor a lo escaneado, el log dice `truncated: true`. Los topes default siguen en 50 posts y 100 comentarios por post.
- **Ocultar** hace `POST /{comment-id}` con `is_hidden=true`. No hay DELETE.
- Graph queda en **v21.0** (el pin del repo). No bajar la versión.
- `META_COMMENTS_ENABLED` sigue en `0`. Este script no suscribe webhooks de `feed` / `comments`.

## B) Manual (Meta Business Suite) — si no hay token

1. **Notificaciones → Comentarios de Facebook**
2. Abrir cada hilo de **Fernando Guglielmelly** → **Ocultar**
3. En un comentario → **⋯ → Bloquear**
4. **Configuración** → lista de palabras prohibidas: `chantas`, `hdp`, `garcas`, `cagadores`, `mafiosos`, `delicuentes`
5. En publicaciones clave → **⋯ → Desactivar comentarios** (o restringir quién puede comentar)
6. Repetir en **Comentarios de Instagram** si aparecen

## C) Checklist post-acción

- [ ] Comentarios de Fernando ocultos en posts recientes
- [ ] Usuario bloqueado en la Página
- [ ] Palabras ofensivas en filtro de la Página
- [ ] Publicaciones con alto alcance: comentarios desactivados o restringidos
- [ ] Instagram revisado

## Notas

- **Ocultar** no borra; el público no ve el comentario; admins sí. El ledger local conserva el texto.
- **Bloquear** impide que esa persona vuelva a comentar / mensajear la Página.
- Desactivar comentarios en una publicación afecta a **cualquiera**, no solo a un usuario.
- No guardar tokens en el repo; usar `.env` / Doppler / secret manager.
