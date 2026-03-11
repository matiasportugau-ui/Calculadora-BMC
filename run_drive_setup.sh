#!/bin/zsh
cd "/Users/matias/Panelin calc loca/Calculadora-BMC" || exit 1
printf 'VITE_GOOGLE_CLIENT_ID=642127786762-a5vph6mfgf16qqv3c125cuin4dge6d6b.apps.googleusercontent.com\n' > .env
echo "[OK] .env creado"
npm install || exit 1
npm run dev
