// Meta owner-notify format leftovers after tip metaNotify + open #1246 parse.
// Tip only pins Ana/Luis/María happy-path lines. This file pins channel aliases,
// author fallbacks, clip limits, and titleBit only on comments.
// Do not re-land #1246 / #1248 / #1263.
// Run: node tests/metaNotifyFormatGates.test.js

import assert from "node:assert/strict";
import {
  channelLabel,
  formatOwnerDigest,
  formatOwnerNotification,
  kindLabel,
} from "../server/lib/meta/notify.js";

assert.equal(channelLabel("instagram"), "IG");
assert.equal(channelLabel("facebook"), "FB");
assert.equal(channelLabel("telegram"), "TELEGRAM");
assert.equal(channelLabel(""), "?");
assert.equal(channelLabel(undefined), "?");

assert.equal(kindLabel({ kind: "comments" }), "comentario");
assert.equal(kindLabel({ message: { metadata: { kind: "comment" } } }), "comentario");
assert.equal(kindLabel({ message: { metadata: { type: "comments" } } }), "comentario");
assert.equal(kindLabel({ message: { metadata: { type: "message" } } }), "DM");
assert.equal(kindLabel({}), "DM");

{
  const named = formatOwnerNotification({
    event: {
      channel: "instagram",
      contact_hint: { name: "Ana", igsid: "IGSID_X" },
      message: { sender_id: "SID", body: "hola" },
    },
    n: 1,
  });
  assert.match(named, /^📩 IG DM #1 · Ana:/);
  assert.equal(named.includes("IGSID_X"), false);
  assert.equal(named.includes("SID"), false);
}

{
  const bySender = formatOwnerNotification({
    event: {
      channel: "ig",
      contact_hint: {},
      message: { sender_id: "IGSID_SENDER", body: "hola" },
    },
    n: 2,
  });
  assert.match(bySender, /IGSID_SENDER/);
}

{
  const byIgsid = formatOwnerNotification({
    event: { channel: "ig", contact_hint: { igsid: "IGSID_ONLY" }, message: { body: "hola" } },
    n: 3,
  });
  assert.match(byIgsid, /IGSID_ONLY/);
}

{
  const byPsid = formatOwnerNotification({
    event: { channel: "facebook", contact_hint: { psid: "PSID_ONLY" }, message: { body: "hola" } },
    n: 4,
  });
  assert.match(byPsid, /^📩 FB DM #4 · PSID_ONLY:/);
}

{
  const unknown = formatOwnerNotification({
    event: { channel: "ig", message: { body: "hola" } },
    n: 5,
  });
  assert.match(unknown, /desconocido/);
}

{
  const line = formatOwnerNotification({
    event: {
      channel: "ig",
      contact_hint: { name: "Ana" },
      message: { body: "  hola   \n\t  mundo  " },
    },
    n: 6,
  });
  assert.match(line, /"hola mundo"/);
}

{
  const body = "x".repeat(400);
  const line = formatOwnerNotification({
    event: { channel: "ig", contact_hint: { name: "Ana" }, message: { body } },
    n: 7,
  });
  const quoted = line.match(/"([^"]*)"/)[1];
  assert.equal(quoted.length, 280);
  assert.equal(quoted, "x".repeat(280));
}

{
  const title = "T".repeat(120);
  const line = formatOwnerNotification({
    event: {
      channel: "ig",
      kind: "comment",
      post_title: title,
      contact_hint: { name: "María" },
      message: { body: "precio?", metadata: { kind: "comment" } },
    },
    n: 8,
  });
  assert.match(line, /comentario/);
  const posted = line.match(/post: "([^"]*)"/)[1];
  assert.equal(posted.length, 80);
  assert.equal(posted, "T".repeat(80));
}

{
  const draft = "d".repeat(900);
  const line = formatOwnerNotification({
    event: { channel: "ig", contact_hint: { name: "Ana" }, message: { body: "hola" } },
    n: 9,
    draft: { text: draft },
  });
  assert.match(line, /💬 Borrador:/);
  const clipped = line.split("💬 Borrador: ")[1].split("\n")[0];
  assert.equal(clipped.length, 800);
  assert.match(line, /→ OK 9 \/ EDITAR 9 <texto> \/ NO 9 \/ OCULTAR 9/);
}

{
  const dm = formatOwnerNotification({
    event: {
      channel: "ig",
      post_title: "10% OFF",
      contact_hint: { name: "Ana" },
      message: { body: "hola", metadata: { post_title: "meta-title" } },
    },
    n: 10,
  });
  assert.match(dm, /DM/);
  assert.equal(dm.includes("post:"), false);
  assert.equal(dm.includes("10% OFF"), false);
}

{
  const comment = formatOwnerNotification({
    event: {
      channel: "ig",
      kind: "comment",
      contact_hint: { name: "María" },
      message: { body: "precio?" },
    },
    n: 11,
  });
  assert.match(comment, /comentario/);
  assert.equal(comment.includes("post:"), false);
}

{
  const empty = formatOwnerNotification({
    event: { channel: "fb", contact_hint: { name: "Luis" }, message: { body: "" } },
    n: 12,
  });
  assert.match(empty, /""/);
}

{
  const noDraft = formatOwnerNotification({
    event: { channel: "ig", contact_hint: { name: "Ana" }, message: { body: "hola" } },
    n: 13,
    draft: {},
  });
  assert.equal(noDraft.includes("Borrador"), false);
  assert.equal(noDraft.includes("EDITAR"), false);
}

{
  const line = formatOwnerNotification({
    event: {
      channel: "ig",
      kind: "comment",
      post_title: "event-title",
      contact_hint: { name: "María" },
      message: { body: "x", metadata: { post_title: "meta-title" } },
    },
    n: 14,
    postTitle: "arg-title",
  });
  assert.match(line, /post: "arg-title"/);
  assert.equal(line.includes("event-title"), false);
  assert.equal(line.includes("meta-title"), false);
}

{
  const digest = formatOwnerDigest([
    { event: { channel: "ig", contact_hint: { name: "A" }, message: { body: "1" } }, n: 1 },
    { event: { channel: "facebook", contact_hint: { name: "B" }, message: { body: "2" } }, n: 2 },
  ]);
  assert.match(digest, /^📩 Meta inbox · 2 eventos \(60s\)/);
  assert.match(digest, /IG DM #1/);
  assert.match(digest, /FB DM #2/);
}

console.log("metaNotifyFormatGates.test.js: ok");
