# ML corpus — exportaciones locales

Aquí escribe por defecto `npm run ml:corpus-export` los archivos:

- `exports/ML-CORPUS-FULL-*.json` — texto completo comprador + respuesta vendedor cuando existe.
- `exports/ML-CORPUS-MINIMAL-*.json` — con `--minimal`, textos truncados.

**Privacidad:** pueden contener datos de terceros. Los `exports/*.json` están en `.gitignore`; regenerá con el comando cuando necesites una captura fresca.

Ver [`../../knowledge/ML-TRAINING-SYSTEM.md`](../../knowledge/ML-TRAINING-SYSTEM.md).
