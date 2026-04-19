# Green Retreats visualiser — reference mirror

This folder contains a **study mirror** of the public 3D garden-room visualiser used on [greenretreats.co.uk](https://www.greenretreats.co.uk/design/). It is **not** part of the Calculadora BMC product; it exists to document architecture and contrast with Panelin’s stack.

## Canonical live URLs

| Layer | URL |
| --- | --- |
| WordPress design page (embeds iframe) | `https://www.greenretreats.co.uk/design/` |
| Visualiser shell (Webflow export, same origin as runtime) | `https://www.greenretreats.co.uk/visualiser-ar-ios/index.html` |
| Verge3D iframe document | `https://www.greenretreats.co.uk/visualiser-ar-ios/gr_visualiser_v2_code.html` |
| Pricing JSON (loaded by iframe; sets `window.priceData`) | `https://my.greenretreats.co.uk/configurator/configurator-api/pricing.php` |

The iframe `src` on `/design/` is `https://www.greenretreats.co.uk/visualiser-ar-ios/index.html` (not the standalone `index.html` in Downloads without that path).

## Mirror contents (`mirror/`)

Files were fetched with `curl` from `https://www.greenretreats.co.uk/visualiser-ar-ios/` on 2026-04-19. Large binaries are intentional for offline inspection.

| Artifact | Role |
| --- | --- |
| `index.html` | Webflow shell: left panel, sliders, price UI, iframe embed |
| `css/*`, `app.css`, `js/webflow.js` | Webflow styling and interactions |
| `images/*` | Shell icons / favicon |
| `gr_visualiser_v2_code.html` | Verge3D entry: container `#v3d-container`, scripts |
| `v3d.js` | Verge3D 3.4.0 runtime (Three.js–based) |
| `gr_visualiser_v2_code.js` | App logic: UI bridge, scene control, pricing helpers |
| `gr_visualiser_v2_code.gltf.xz` | **Compressed** scene asset loaded at runtime (`url = './gr_visualiser_v2_code.gltf.xz'` in app JS) |
| `gr_visualiser_v2_code.gltf` / `.bin` | Uncompressed glTF + buffer (useful for glTF tools; runtime prefers `.xz`) |
| `gr_visualiser_v2_code.gltf.xz` | **Runtime** asset (XZ-compressed glTF) loaded by `gr_visualiser_v2_code.js` |
| `*.jpg`, `ar-image.png`, `green-retreats-logo-2019.png` | Textures / AR / preloader branding |
| `pricing.json.sample` | Snapshot of `pricing.php` response (JSONP-style callback `configuratorPricing(...)`) |

Missing from mirror (404 or optional): `Cedar_PRM_D.jpg` was not found at time of harvest; the live app may use fallbacks or different paths.

## Local smoke test

From `mirror/`:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/index.html`. The shell expects same-origin iframe at `gr_visualiser_v2_code.html`; pricing still loads from `my.greenretreats.co.uk` unless you edit the HTML or use a local stub.

## Legal / redistribution

Third-party bundles (`v3d.js`, scene assets) are **Green Retreats / Soft8Soft** intellectual property. Keep this mirror for **internal study**; do not ship it as part of a public product without rights clearance.

## Full documentation

See [ARCHITECTURE.md](./ARCHITECTURE.md) for engine stack, parent–iframe contract, configuration model, and contrast with Calculadora BMC.
