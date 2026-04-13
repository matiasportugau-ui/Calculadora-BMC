# Registro maestro de credenciales y variables (local, cifrado)

Este directorio documenta cómo generar el **inventario maestro** de APIs, variables y estado local **sin commitear secretos**. El artefacto sensible debe quedar **cifrado con contraseña** en tu máquina (carpeta `local/`, gitignored).

## Requisitos

- Node.js 18+ (mismo que el repo).
- Opcional: API en `http://localhost:3001` si usás `--probe-local` para una fila extra de health agregada al informe (no envía secretos).

## Comandos

```bash
# Genera Markdown en docs/team/credentials-registry/local/ (gitignored)
npm run credentials:registry

# Igual que arriba + intenta GET /health local (puerto 3001) para el bloque JSON
npm run credentials:registry:probe

# Regenera el .md y lo cifra → .enc (contraseña por consola; **sobrescribe** el Markdown)
npm run credentials:registry:encrypt

# Tras editar el .md a mano: solo cifrar (no regenerar)
npm run credentials:registry:encrypt:only

# Descifra a stdout (redirigí a un archivo solo en lugar seguro)
npm run credentials:registry:decrypt -- docs/team/credentials-registry/local/CREDENTIALS-MASTER-REGISTRY.enc
```

Variables de entorno opcionales (para automatizar sin prompt):

- `CREDENTIALS_REGISTRY_PASS`: contraseña para cifrar/descifrar (evitar en shells compartidos; preferí escribirla al pedirla).
- `CREDENTIALS_REGISTRY_OUT`: ruta del `.md` generado (default bajo `local/`).

## Fuentes que el script usa hoy

| Fuente | Qué aporta |
|--------|------------|
| [`.env.example`](../../../.env.example) | Lista canónica + comentarios (funcionalidad). |
| [`server/config.js`](../../../server/config.js) | `process.env.*` referenciados en config. |
| Código `server/` y `src/` | Nombres adicionales (`process.env.*`, `import.meta.env.*`). |
| `.env` local (si existe) | Solo estado **definida vacía / definida con valor / ausente** (nunca el valor). |

**No incluido automáticamente** (habilitalo vos cuando corresponda, antes de cifrar):

- Variables en **Google Cloud Run** o **Vercel**: exportá desde consola / CLI y pegá una sección al final del `.md` generado, o copiá el archivo y editá manualmente.
- **Meta / ML / Shopify** dashboards: mismos criterios; solo metadatos y fechas, sin pegar client secrets en claro.

## Si el descifrado falla (`authenticate` / `Unsupported state`)

Eso casi siempre es **contraseña distinta** a la usada al cifrar, o un **`.enc` corrupto** (por ejemplo si se abrió/guardó como texto en un editor).

- Volvé a ejecutar `decrypt` con la **misma** contraseña que usaste en `encrypt` / `encrypt:only` (mismos caracteres; el script recorta espacios y saltos de línea al final del pegado).
- Si cifraste con `CREDENTIALS_REGISTRY_PASS` en el entorno, descifrá con la misma variable exportada en esa terminal.
- Si no recordás la contraseña: **no se puede recuperar** el contenido desde el `.enc`; generá de nuevo `npm run credentials:registry:probe`, editá, `encrypt:only` con una clave nueva y guardala en un gestor.

Tratá el `.enc` como **binario**: no lo re-guardes desde el editor como si fuera texto.

## Seguridad

- El `.md` en claro en `local/` puede contener **longitudes** y nombres de claves; igual tratá el archivo como sensible hasta cifrarlo.
- **No** subas `.enc` a Git si dentro incluiste texto con secretos pegados; el default del script no vuelca valores de `.env`.
- Rotá la contraseña del cifrado si la compartiste o la escribiste en un gestor inseguro. **No pegues la contraseña de descifrado en chats** ni en issues.

## Plantilla de columnas (rellenar a mano)

Después de generar, completá en el Markdown: **fecha de implementación / última rotación**, **health** por flujo y notas por entorno (Run/Vercel) según tu plan de completitud.
