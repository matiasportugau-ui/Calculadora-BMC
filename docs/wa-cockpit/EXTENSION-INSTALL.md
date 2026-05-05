# WA Cockpit Extension — instalación dev y publicación

Repo aparte: **calculadora-bmc-wa-extension** (no es parte de este monorepo).

---

## Instalación dev (carga descomprimida)

1. Cloná y construí la extensión:

   ```bash
   git clone https://github.com/<org>/calculadora-bmc-wa-extension.git
   cd calculadora-bmc-wa-extension
   npm install
   npm run build  # genera .output/chrome-mv3/
   ```

2. Abrí `chrome://extensions` en Chrome.
3. Activá **Modo de desarrollador** (toggle arriba a la derecha).
4. **Cargar extensión sin empaquetar** → seleccioná la carpeta `.output/chrome-mv3/`.
5. Pin a la barra para tener acceso rápido.

---

## Configuración por primera vez

1. Abrí WhatsApp Web (`https://web.whatsapp.com/`) en el mismo perfil de Chrome donde está la extensión, con tu sesión logueada.
2. Click en el ícono de la extensión → popup.
3. Pegá el **API_AUTH_TOKEN cockpit** (el mismo que usás en ML / Admin / Canales). Se guarda en `chrome.storage.local`.
4. Pegá la URL del API:
   - **Producción**: `https://panelin-calc-q74zutv7dq-uc.a.run.app`
   - **Local dev**: `http://localhost:3001`
5. Toggle **Sync ON**.
6. Click **Sync histórico** → la extensión vuelca el IndexedDB de WA Web (todos los chats que ya tenés en disco) en lotes a `/api/wa/ingest`.
7. Andá al SPA en `/wa` (`https://calculadora-bmc.vercel.app/wa` o `http://localhost:5173/wa`) y validá la lista.

> **Tiempo esperado**: 5.000 mensajes scrapeados en <30s; mostrados en `/wa` <10s.

---

## Privacidad y seguridad

- El token jamás se inyecta en el DOM de WhatsApp; vive aislado en el storage de la extensión.
- La extensión NO envía mensajes automáticamente (default lectura-only). El paste-back F2 requiere confirmación humana con Enter.
- Los logs Cloud Run no contienen el cuerpo del mensaje; solo `msg_id` + `chat_id`.

---

## Resolución de problemas

| Síntoma | Causa probable | Acción |
|---------|----------------|--------|
| `/api/wa/health` responde 503 | `DATABASE_URL` no configurado en el entorno | Setear var, `npm run wa:migrate` |
| `Sync histórico` no avanza | IndexedDB de WA Web vacío | Esperar a que WA Web cargue chats; refrescar la pestaña |
| 401 en POST /api/wa/ingest | Token incorrecto / expirado | Re-pegar token en popup |
| Lista vacía en /wa | Filtros activos | Limpiar buscador y status |
| WA Web cambió DOM y rompe scrape | Chrome extension no actualizada | Esperar nuevo build con selectors patcheados |

---

## Publicación futura en Chrome Web Store

- Cuenta de desarrollador BMC (USD 5 una vez).
- Empaquetar `.zip` desde `.output/chrome-mv3/`.
- Subir a [Chrome Web Store Dashboard](https://chrome.google.com/webstore/devconsole/) como **unlisted** (solo operadores BMC con link).
- `update_url` en manifest apunta al feed XML auto-publicado por Google → la extensión se autoactualiza al próximo `chrome restart`.
- Revisar el manifiesto `host_permissions`: solo `web.whatsapp.com` y la URL de Cloud Run de prod (no usar wildcards amplios — Google rechaza).
