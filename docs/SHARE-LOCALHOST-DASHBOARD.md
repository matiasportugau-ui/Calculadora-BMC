# Share Localhost — Configurar el dashboard BMC para compartir

Guía para exponer tu **BMC Dashboard** (y opcionalmente la API) con una URL pública HTTPS usando el **ngrok Agent CLI**, siguiendo el [Share Localhost Quickstart](https://ngrok.com/docs/getting-started/) de ngrok.

**Documentación ngrok:** índice completo en [https://ngrok.com/docs/llms.txt](https://ngrok.com/docs/llms.txt).

---

## Qué necesitás

- [Cuenta ngrok](https://dashboard.ngrok.com/signup)
- [Auth token](https://dashboard.ngrok.com/get-started/your-authtoken)
- En macOS: [Homebrew](https://brew.sh/)

---

## 1. Instalar ngrok Agent CLI

**macOS (Homebrew):**

```bash
brew install ngrok
```

**Debian Linux:**

```bash
curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc \
  | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null \
  && echo "deb https://ngrok-agent.s3.amazonaws.com buster main" \
  | sudo tee /etc/apt/sources.list.d/ngrok.list \
  && sudo apt update \
  && sudo apt install ngrok
```

Comprobar instalación:

```bash
ngrok help
```

---

## 2. Conectar tu cuenta

Reemplazá `$YOUR_TOKEN` por tu token del [dashboard ngrok](https://dashboard.ngrok.com/get-started/your-authtoken):

```bash
ngrok config add-authtoken $YOUR_TOKEN
```

---

## 3. Arrancar el dashboard (o el stack)

Elegí **uno** de estos modos:

| Modo | Puerto | Comando | Qué exponés |
|------|--------|---------|--------------|
| **Solo dashboard** | 3849 | `npm run bmc-dashboard` | Dashboard Finanzas (Sheets API + UI) |
| **API + dashboard** | 3001 | `npm run dev:full` o `npm run start:api` | API REST + redirect a `/finanzas` (dashboard estático servido por Express) |

- **Dashboard standalone (3849):** ideal para compartir solo la vista Finanzas/Operaciones.
- **API 3001:** una sola URL; `/` redirige a `/finanzas`, y tenés también `/calc/*`, etc. Ver [NGROK-USAGE.md](NGROK-USAGE.md).

---

## 4. Exponer con ngrok

Con el servicio ya corriendo, en **otra terminal** ejecutá:

**Opción A — Solo dashboard (puerto 3849):**

```bash
ngrok http 3849
```

**Opción B — API + dashboard (puerto 3001):**

```bash
ngrok http 3001
```

ngrok mostrará una URL pública HTTPS (ej. `https://xxxx-xx-xx-xx-xx.ngrok-free.dev`). Esa es la URL para compartir tu dashboard.

El **Inspector** de tráfico está en [http://127.0.0.1:4040](http://127.0.0.1:4040) mientras el agente esté activo.

---

## 5. (Opcional) Proteger con Google OAuth

Para que solo usuarios con cuenta Google (ej. dominio `@tudominio.com`) puedan entrar:

1. Detené el túnel ngrok (Ctrl+C).
2. Abrí la config:

   ```bash
   ngrok config edit
   ```

3. Debajo del `authtoken`, agregá un endpoint con política de tráfico. Para **dashboard en 3849**:

   ```yaml
   endpoints:
     - name: bmc-dashboard
       # url: opcional en plan free; en planes pagos podés fijar dominio
       traffic_policy:
         on_http_request:
           - actions:
               - type: oauth
                 config:
                   provider: google
           - expressions:
               - "!actions.ngrok.oauth.identity.email.endsWith('@tudominio.com')"
             actions:
               - type: deny
       upstream:
         url: 3849
         protocol: http1
   ```

   Para **API + dashboard en 3001**, usá `url: 3001` en `upstream` y el mismo bloque `traffic_policy`.

4. Iniciá por nombre:

   ```bash
   ngrok start bmc-dashboard
   ```

Al visitar la URL pública, ngrok pedirá login con Google y rechazará correos que no terminen en `@tudominio.com`.

Para OAuth con app Google propia, ver [OAuth Traffic Policy](https://ngrok.com/docs/traffic-policy/actions/oauth/#google-example).

---

## Script rápido (repo)

Desde la raíz del repo:

```bash
./scripts/run_share_dashboard.sh
```

El script comprueba que ngrok esté instalado y que el dashboard (o la API) esté escuchando; si no, te indica qué comando ejecutar. Luego lanza `ngrok http` al puerto correcto según la opción (dashboard solo o API).

---

## Resumen de comandos

```bash
# 1. Una sola vez
brew install ngrok
ngrok config add-authtoken $YOUR_TOKEN

# 2. Terminal 1: app
npm run bmc-dashboard    # dashboard en :3849
# o
npm run dev:full          # API + dashboard en :3001

# 3. Terminal 2: túnel
ngrok http 3849          # solo dashboard
# o
ngrok http 3001          # API + dashboard
```

---

## Referencias

- [ngrok docs index](https://ngrok.com/docs/llms.txt)
- [Agent CLI Quickstart](https://ngrok.com/docs/getting-started/)
- [Share Local APIs](https://ngrok.com/docs/guides/share-localhost/apis)
- [Traffic Policy — OAuth](https://ngrok.com/docs/guides/share-localhost/auth)
- [NGROK-USAGE.md](NGROK-USAGE.md) — uso de ngrok en este repo (puertos, tráfico 200/404)
