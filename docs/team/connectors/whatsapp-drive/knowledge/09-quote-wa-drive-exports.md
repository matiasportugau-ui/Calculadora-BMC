# Cotización → WhatsApp → Drive (tres exports, no un conector)

La calculadora ofrece **caminos paralelos**. No hay pipeline “PDF a Drive y luego plantilla WA” en código.

## 1. Texto WhatsApp (clipboard / wa.me)

`buildWhatsAppText` en `src/utils/helpers.js`: copy en español con totales USD para pegar o abrir WhatsApp.

No sube archivos. No crea carpetas Drive.

## 2. PDF

`src/utils/pdfGenerator.js`: intenta `POST /api/pdf/generate` (Playwright/Chromium server) y cae a html2pdf.js. Layouts en `src/pdf-templates/` + `classic` (`generateClientVisualHTML`). Preferencia `localStorage` `bmc.pdfLayout`.

El PDF puede ir a GCS (link público para tools) **y/o** a Drive (archivo).

## 3. Drive

- Personal GIS: guardar/cargar desde `GoogleDrivePanel`.
- Empresa: `POST /api/quotes/drive-archive` (PDF + `.bmc.json`).
- Link Drive a veces se pega en Sheets Ventas (`HYPERLINK`) para logística.

## Tool send

`enviar_whatsapp_link` manda **texto + URL** (GCS preferido). No adjunta el PDF binario por Cloud API en este path. Media Cloud API (imagen/documento) no es el sender unificado actual (`type: "text"` only en `whatsappOutbound.js`).

## Visión vs hecho

Estudios/backlog mencionan “PDF → link Drive → plantilla WhatsApp”. **No implementado** como conector. Reutilizar:

- Outbound texto ya unificado.
- Archive Drive ya escribe el bundle.
- Falta: resolver URL compartible del archivo empresa (a menudo `drive.file` + carpeta no pública) y un paso humano “enviar este link”.

Si el operador pide “mandale la cotización”:

1. Confirmar teléfono del **cliente**.
2. Preferir URL GCS/pública del PDF.
3. Si solo hay Drive privado, el adjunto fetch / share link debe ser accesible; si no, no afirmar que se envió el archivo.
4. `user_confirmed` + send.
