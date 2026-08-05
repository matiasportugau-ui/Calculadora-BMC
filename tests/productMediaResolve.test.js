/**
 * Shopify product media resolver (#862) — familia fallbacks + catalog row edges.
 * Run: node tests/productMediaResolve.test.js
 */
import {
  resolveBorderMedia,
  resolvePanelMedia,
  resolveAccessoryMedia,
  resolveCatalogRowMedia,
  panelFamGroup,
  resolveFromLink,
} from "../src/data/product-media/productMediaResolve.js";

let p = 0;
let f = 0;
const ok = (c, m) => {
  if (c) {
    p++;
    console.log("  ✓", m);
  } else {
    f++;
    console.error("  ✗", m);
  }
};

console.log("productMediaResolve");

ok(panelFamGroup("ISODEC_EPS") === "ISODEC", "fam group ISODEC");
ok(panelFamGroup("ISODEC_PIR_100") === "ISODEC_PIR", "fam group ISODEC_PIR");
ok(panelFamGroup("ISOROOF_COLONIAL_X") === "ISOROOF_COLONIAL", "fam group colonial");
ok(panelFamGroup("ISOWALL_EPS") === "ISOWALL", "fam group ISOWALL");
ok(panelFamGroup("") === "", "empty fam");

const b = resolveBorderMedia({ borderId: "babeta_empotrar", familia: "ISODEC" });
ok(!!b.primaryImage, "babeta image");
ok(!/isowall/i.test(b.primaryImage || ""), "babeta not isowall");
ok(/babeta/i.test(b.title + b.handle), "babeta title/handle");

const none = resolveBorderMedia({ borderId: "none" });
ok(none.status === "none" && !none.primaryImage, "border none → empty");

const unlinked = resolveBorderMedia({ borderId: "no_such_border_xyz" });
ok(unlinked.status === "unlinked" && !unlinked.primaryImage, "unknown border unlinked");

const panel = resolvePanelMedia({ familia: "ISODEC_EPS" });
ok(!!panel.primaryImage, "panel image");

const noPanel = resolvePanelMedia({});
ok(noPanel.status === "unlinked", "panel without familia");

const emptyLink = resolveFromLink(null);
ok(emptyLink.source === "missing" && emptyLink.status === "none", "null link → missing");

// Catalog row: perfil id encoding pt:borderId:familia
const rowPerfil = resolveCatalogRowMedia({
  kind: "perfil",
  id: "pt:babeta_empotrar:ISODEC",
  label: "Babeta",
});
ok(!!rowPerfil.primaryImage, "catalog perfil id resolves border media");

const rowLabel = resolveCatalogRowMedia({
  kind: "perfil",
  id: "pt:unknown:ISODEC",
  label: "Babeta para empotrar lateral",
});
ok(!!rowLabel.primaryImage, "catalog perfil label fallback babeta_empotrar");

const rowEmpty = resolveCatalogRowMedia(null);
ok(rowEmpty.status === "unlinked", "null catalog row");

// Accessory path — may be unlinked in catalog; must not throw
const acc = resolveAccessoryMedia({ kind: "fijacion", key: "__no_such_key__" });
ok(!acc.primaryImage && (acc.status === "unlinked" || acc.status === "none" || acc.source === "missing"), "missing accessory safe");

console.log(`\n${p} passed, ${f} failed`);
process.exit(f ? 1 : 0);
