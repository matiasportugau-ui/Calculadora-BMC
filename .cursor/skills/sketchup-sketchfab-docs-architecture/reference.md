# Referencia — Sketchfab, Quantifier Pro, SketchUp

Material de apoyo para [SKILL.md](SKILL.md). El agente debe **confirmar rutas y parámetros** en la documentación vigente del vendor; esta página es un **mapa mental**, no un sustituto de la API reference.

## Sketchfab — mapa por subsistema

| Subsistema | Rol típico | Verificación |
|------------|------------|--------------|
| **Sketchfab Login (OAuth2)** | Conectar cuentas / obtener tokens según flujo documentado | Scopes y redirect URIs en la consola de desarrollador |
| **Data API** | Metadatos, modelos, gestión de contenido vía API | Paginación, autenticación, límites en la doc actual |
| **Download API** | Descarga de assets según permisos y modelo de licencia | Restricciones por modelo/usuario |
| **Viewer API** | Embed y control del visor 3D en páginas propias | API JS del viewer vs REST; versión del script |
| **oEmbed** | Incrustar a partir de URL de modelo | Formato oEmbed, parámetros permitidos |

**Enlaces de entrada (canónicos a nivel “portal”):**

- Overview developers: `https://sketchfab.com/developers`
- Developer Guidelines y Terms of Use: enlazados desde el mismo portal (revisar la versión vigente).

**Recordatorio:** los paths exactos de REST y los campos JSON cambian; **no** copiar tablas de endpoints desde memoria — usar la doc publicada o respuestas de ejemplo con fecha.

## Quantifier Pro (mind.sight.studios)

- **Página producto:** `https://mindsightstudios.com/quantifier-pro/`
- **Tipo de sistema:** extensión/plugin de SketchUp orientada a **medición y costos** en el modelo (reportes exportables según el vendor).
- **Verificación útil:** Help Desk / guías del editor (enlaces desde el sitio del producto) para lista exacta de formatos (HTML/CSV/Excel) y requisitos de SO.

**Límite:** salvo documentación explícita del vendor, no asumir endpoints HTTP ni SDK público para automatizar Quantifier Pro desde fuera de SketchUp.

## SketchUp — documentación normativa vs foros

| Tipo | Dónde | Uso |
|------|-------|-----|
| **Ruby API / plataforma** | Documentación oficial Trimble / Developer Center (según tema) | Contrato y comportamiento soportado |
| **Foros** | `https://forums.sketchup.com` | Soporte entre pares, workarounds, interpretación — siempre con **nivel de confianza** |

Si el hilo contradice la documentación oficial, **priorizar la oficial** y documentar el conflicto en el entregable.

## Checklist rápido antes de cerrar un informe

- [ ] ¿La petición se clasificó en A / B / C?
- [ ] ¿Cada afirmación técnica tiene **URL + fecha** o está marcada como inferencia?
- [ ] ¿Las incertidumbres y “pendiente de verificar” están listadas?
- [ ] ¿Se evitó inventar endpoints o campos de API?
