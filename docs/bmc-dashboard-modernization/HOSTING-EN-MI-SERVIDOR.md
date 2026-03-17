# Alojar el BMC Dashboard en tu propio host

Cómo correr el dashboard (Sheets API + UI) en **tu servidor** (VPS, máquina en casa, etc.) en lugar de solo compartir por ngrok.

---

## Requisitos en el host

- **Node.js 18+**
- Acceso a la máquina (SSH o panel)
- (Opcional) Dominio y certificado HTTPS (recomendado si es público)

---

## 1. Subir el proyecto (o solo el dashboard)

**Opción A — Clonar el repo en el host:**

```bash
git clone https://github.com/matiasportugau-ui/Calculadora-BMC.git
cd Calculadora-BMC
npm install
```

**Opción B — Copiar solo lo necesario** (menos peso):

En tu Mac, empaquetar:

```bash
cd "/Users/matias/Panelin calc loca/Calculadora-BMC"
tar -czvf bmc-dashboard-deploy.tar.gz \
  package.json package-lock.json \
  docs/bmc-dashboard-modernization/sheets-api-server.js \
  docs/bmc-dashboard-modernization/dashboard
```

Subir `bmc-dashboard-deploy.tar.gz` al host, descomprimir y en la carpeta donde esté `package.json` ejecutar `npm install` (solo instala dependencias del proyecto; el servidor del dashboard usa `googleapis` y `dotenv`, que ya están en el package.json del repo).

---

## 2. Variables de entorno en el host

Crear un `.env` en la **raíz del proyecto** (o donde ejecutes el servidor):

```bash
# Obligatorios para el dashboard
BMC_SHEET_ID=id-de-tu-google-sheet
GOOGLE_APPLICATION_CREDENTIALS=/ruta/absoluta/en/el/host/service-account.json

# Opcional: puerto (por defecto 3849)
BMC_SHEETS_API_PORT=3849
```

- **BMC_SHEET_ID:** ID de la hoja de cálculo (Master_Cotizaciones, etc.).
- **GOOGLE_APPLICATION_CREDENTIALS:** ruta en el **servidor** al JSON de la cuenta de servicio de Google. Subí el `service-account.json` a una ruta segura (ej. `/opt/bmc-dashboard/secrets/service-account.json`) y poné esa ruta en el `.env`.

---

## 3. Arrancar el servidor

Desde la raíz del repo en el host:

```bash
node docs/bmc-dashboard-modernization/sheets-api-server.js
```

O con el script npm:

```bash
npm run bmc-dashboard
```

El dashboard queda en `http://localhost:3849` (o el puerto que definiste).

---

## 4. Dejarlo corriendo siempre (recomendado)

**Con PM2:**

```bash
npm install -g pm2
pm2 start docs/bmc-dashboard-modernization/sheets-api-server.js --name bmc-dashboard
pm2 save
pm2 startup   # te dice cómo activar el arranque al reiniciar el host
```

**Con systemd** (ejemplo en Linux):

Crear `/etc/systemd/system/bmc-dashboard.service`:

```ini
[Unit]
Description=BMC Dashboard (Sheets API)
After=network.target

[Service]
Type=simple
User=tu_usuario
WorkingDirectory=/ruta/a/Calculadora-BMC
EnvironmentFile=/ruta/a/Calculadora-BMC/.env
ExecStart=/usr/bin/node docs/bmc-dashboard-modernization/sheets-api-server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Luego:

```bash
sudo systemctl daemon-reload
sudo systemctl enable bmc-dashboard
sudo systemctl start bmc-dashboard
```

---

## 5. Exponer con HTTPS (nginx en tu host)

Si querés que se acceda por `https://tudominio.com` (o por IP con certificado):

1. **Nginx** como reverse proxy al puerto 3849 (o al que uses).
2. **Certificado:** Let's Encrypt con `certbot`.

Ejemplo mínimo de sitio en nginx:

```nginx
server {
    listen 80;
    server_name tudominio.com;
    location / {
        proxy_pass http://127.0.0.1:3849;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Después:

```bash
sudo certbot --nginx -d tudominio.com
```

Así el dashboard queda alojado en tu host con HTTPS.

---

## Resumen

| Paso | Acción |
|------|--------|
| 1 | Subir repo (o solo dashboard + package.json) y hacer `npm install` |
| 2 | Configurar `.env` con `BMC_SHEET_ID` y `GOOGLE_APPLICATION_CREDENTIALS` |
| 3 | Probar con `npm run bmc-dashboard` |
| 4 | Dejarlo fijo con PM2 o systemd |
| 5 | (Opcional) Nginx + certbot para HTTPS en tu dominio |

Si tu host está en tu red local y no exponés el puerto a internet, podés usar solo HTTP y acceder por `http://ip-del-host:3849`. Para acceso desde fuera, conviene HTTPS y (si querés) restringir IP o poner auth en nginx.

---

## Exportar condiciones y características del servidor (mientras está levantado)

Con el dashboard corriendo, podés pedir un JSON con todos los endpoints, estado de env (sin valores secretos) y features:

```bash
curl -s http://localhost:3849/api/server-export
```

Para guardarlo en un archivo (mientras estás “logged in” al servidor):

```bash
curl -s http://localhost:3849/api/server-export -o bmc-dashboard-export.json
```

Si el dashboard está en otro host o puerto, reemplazá `localhost:3849` por la URL correcta (ej. `https://tu-dominio.com` si está detrás de nginx). El export incluye: lista de endpoints, métodos, descripción, env vars (set/unset, sin valores), `sheetsConfigured` y timestamp.

---

## Hosting en Netuy (Uruguay)

Para guiar el deploy paso a paso en un VPS Netuy, usá el **agente** `bmc-dashboard-netuy-hosting` o el **skill** `bmc-dashboard-netuy-hosting` (`.cursor/agents/` y `.cursor/skills/`).

Si tu host es **Netuy** (netuy.net):

- **VPS Cloud:** La guía de arriba aplica tal cual. Netuy da VPS con Linux (Ubuntu, Debian, etc.), acceso root y NVMe; podés instalar Node.js 18+, PM2 y nginx. Los datos quedan en Uruguay (Tier III), alineado con Ley 18.331.
- **Pasos en Netuy:** Contratás un VPS, entrás por SSH, instalás Node (ej. con `nvm` o el Node de la distro), subís el proyecto o el tarball del dashboard, configurás `.env` y `GOOGLE_APPLICATION_CREDENTIALS`, y seguís desde el paso 3 (arrancar el servidor) y 4 (PM2 o systemd). Para HTTPS con tu dominio en Netuy, usás nginx + certbot como en el paso 5.
- **Solo hosting compartido (cPanel):** En planes compartidos típicos no suele haber Node.js ni posibilidad de correr un proceso propio. En ese caso conviene seguir usando **ngrok** para compartir el dashboard desde tu Mac, o pasar a un **VPS** de Netuy para alojarlo ahí.

Resumen: con **VPS Netuy** podés alojar el dashboard siguiendo esta misma guía; con hosting compartido, la opción práctica es ngrok o un VPS.
