# Google Sheets en Cloud Run — pasos simples (casi asistidos)

**Meta:** que el servidor pueda escribir en la planilla. Sin esto, WhatsApp puede llegar pero **no** aparece fila en CRM.

**Tiempo aproximado:** 20–40 min la primera vez.

**Proyecto GCP (repo):** `chatbot-bmc-live` · **Servicio:** `panelin-calc` · **Región:** `us-central1`

---

## Parte A — Crear o usar una “cuenta robot” (service account)

1. Abrí: [Cuentas de servicio](https://console.cloud.google.com/iam-admin/serviceaccounts?project=chatbot-bmc-live)
2. Si **ya tenés** una para BMC/Sheets, usá esa. Si no: **Crear cuenta de servicio** → nombre libre (ej. `bmc-sheets`) → **Crear y continuar** → rol mínimo: **Editor** de datos en Sheets no es un rol global; lo importante es el paso 4 (compartir planilla). Podés dejar **Sin rol** en el proyecto si solo usás Sheets vía API y compartís la planilla. → **Listo**.
3. Entrá a esa cuenta → pestaña **Claves** → **Agregar clave** → **Crear clave nueva** → tipo **JSON** → **Crear**.  
   Se baja un archivo `.json` a tu computadora. **No lo subas a Git. No lo pegues en el chat.**

---

## Parte B — Darle acceso a la planilla (Google Sheets)

1. Abrí el archivo JSON que bajaste con un editor de texto.
2. Buscá la línea **`"client_email"`**. Copiá el correo (termina en `@...iam.gserviceaccount.com`).
3. Abrí tu planilla **2.0 Administrador** en el navegador.
4. Clic **Compartir** → pegá ese correo → permiso **Editor** → **Enviar**.

---

## Parte C — Guardar el JSON en Secret Manager

1. Abrí: [Secret Manager](https://console.cloud.google.com/security/secret-manager?project=chatbot-bmc-live)
2. **Crear secreto** → nombre: `bmc-sheets-sa-json` (o el que quieras, pero anotá el nombre).
3. **Valor del secreto:** subí el archivo JSON o pegá todo el contenido del archivo → **Crear secreto**.

---

## Parte D — Montar el secreto en Cloud Run

1. Abrí: [Cloud Run — panelin-calc](https://console.cloud.google.com/run/detail/us-central1/panelin-calc?project=chatbot-bmc-live)
2. Arriba: **EDITAR Y DESPLEGAR NUEVA REVISIÓN**.
3. Pestaña **Volúmenes** (o **Volumes**):
   - **Agregar volumen** → tipo **Secreto** (Secret).
   - Secreto: el que creaste (`bmc-sheets-sa-json`).
   - Ruta de montaje (mount path): escribí exactamente: `/secrets`
4. Pestaña **Contenedores** → tu contenedor → **Montajes de volumen** (Volume mounts):
   - Volumen: el que acabás de crear.
   - Ruta de montaje en el contenedor: a veces la UI genera un **nombre de archivo**. Si te pide “ruta del archivo”, usá por ejemplo:  
     `/secrets/bmc-sheets-sa-json`  
     (debe ser la ruta **completa** al archivo JSON **dentro** del contenedor).  
   **Nota:** según la versión de la consola, el archivo puede aparecer como `/secrets/1` o con el nombre del secreto. Lo importante: **anotá la ruta final que muestra la consola** después de guardar el montaje.

5. Pestaña **Variables y secretos** → **Agregar variable**:
   - Nombre: `GOOGLE_APPLICATION_CREDENTIALS`
   - Valor: la **misma ruta completa** al archivo JSON dentro del contenedor (ej. `/secrets/bmc-sheets-sa-json`).  
     Debe ser **idéntica** a donde quedó montado el archivo.

6. **Otra variable obligatoria:**
   - Nombre: `BMC_SHEET_ID`
   - Valor: el ID de la planilla (está en la URL de Google Sheets: entre `/d/` y `/edit`).

7. **DESPLEGAR** / **DEPLOY**. Esperá a que termine (barra verde / revisión nueva lista).

---

## Parte E — Comprobar que funcionó

1. Abrí en el navegador:  
   `https://panelin-calc-q74zutv7dq-uc.a.run.app/health`
2. Buscá `"hasSheets": true`.  
   - Si ves **`false`**: la ruta del archivo no coincide, falta `BMC_SHEET_ID`, o el montaje falló. Revisá Parte D.

---

## Si algo falla (corto)

| Síntoma | Qué revisar |
|---------|-------------|
| `hasSheets: false` | `GOOGLE_APPLICATION_CREDENTIALS` = ruta exacta al archivo montado; `BMC_SHEET_ID` correcto; planilla compartida con `client_email`. |
| Error al desplegar | Permisos: la cuenta que usás en la consola debe poder usar Secret Manager y Cloud Run. |
| No encontrás “Volúmenes” | Usá la UI nueva de Cloud Run (2024+); a veces está en **Seguridad** / **Secrets** dentro de la revisión. |

---

## Después de esto

Seguí WhatsApp en [`HUMAN-GATES-ONE-BY-ONE.md`](./HUMAN-GATES-ONE-BY-ONE.md) bloque **cm-0** (Meta webhook + teléfono).
