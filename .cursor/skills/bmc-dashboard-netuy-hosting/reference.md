# BMC Dashboard Netuy Hosting — Referencia rápida

Comandos y fragmentos para deploy en VPS Netuy. Guía completa: [HOSTING-EN-MI-SERVIDOR.md](../../../docs/bmc-dashboard-modernization/HOSTING-EN-MI-SERVIDOR.md).

---

## Empaquetar en local (opción B)

```bash
cd /ruta/a/Calculadora-BMC
tar -czvf bmc-dashboard-deploy.tar.gz \
  package.json package-lock.json \
  docs/bmc-dashboard-modernization/sheets-api-server.js \
  docs/bmc-dashboard-modernization/dashboard
```

Subir `bmc-dashboard-deploy.tar.gz` al VPS (scp, rsync, o panel Netuy).

---

## En el VPS — instalación

```bash
# Opción A: clonar repo
git clone https://github.com/matiasportugau-ui/Calculadora-BMC.git
cd Calculadora-BMC

# Opción B: descomprimir tarball
tar -xzvf bmc-dashboard-deploy.tar.gz
cd <carpeta-descomprimida>

npm install
```

---

## .env en el VPS

Crear en la raíz del proyecto (donde está `package.json`):

```bash
BMC_SHEET_ID=id-de-tu-google-sheet
GOOGLE_APPLICATION_CREDENTIALS=/ruta/absoluta/en/el/vps/service-account.json
BMC_SHEETS_API_PORT=3849
```

Subir el `service-account.json` a una ruta segura en el VPS (ej. `/opt/bmc-dashboard/secrets/service-account.json`) y usar esa ruta en `GOOGLE_APPLICATION_CREDENTIALS`.

---

## Probar

```bash
npm run bmc-dashboard
# Dashboard en http://localhost:3849
```

---

## PM2 (recomendado)

```bash
npm install -g pm2
pm2 start docs/bmc-dashboard-modernization/sheets-api-server.js --name bmc-dashboard
pm2 save
pm2 startup
```

---

## systemd

Archivo `/etc/systemd/system/bmc-dashboard.service`:

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

```bash
sudo systemctl daemon-reload
sudo systemctl enable bmc-dashboard
sudo systemctl start bmc-dashboard
```

---

## Nginx + HTTPS (certbot)

Sitio en nginx (ej. `/etc/nginx/sites-available/bmc-dashboard`):

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

```bash
sudo certbot --nginx -d tudominio.com
```

---

## Verificar después del deploy

```bash
curl -s http://localhost:3849/api/server-export | jq .
# O con dominio: curl -s https://tudominio.com/api/server-export | jq .
```
