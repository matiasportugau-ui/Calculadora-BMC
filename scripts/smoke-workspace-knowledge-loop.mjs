#!/usr/bin/env node
/**
 * Smoke: create knowledge CR → approve → training-kb match.
 * Requires API on BMC_API_BASE (default :3001), DATABASE_URL, appEnv development.
 *
 *   npm run smoke:workspace-knowledge
 */
const base = (process.env.BMC_API_BASE || "http://127.0.0.1:3001").replace(/\/+$/, "");

async function main() {
  const loginRes = await fetch(`${base}/api/auth/dev-browser-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.DEV_LOGIN_EMAIL || "matias.portugau@gmail.com",
    }),
  });
  const login = await loginRes.json().catch(() => ({}));
  if (!login.ok || !login.accessToken) {
    console.error("LOGIN_FAIL", loginRes.status, login);
    process.exit(1);
  }
  const headers = {
    Authorization: `Bearer ${login.accessToken}`,
    "Content-Type": "application/json",
  };
  const q = `Smoke loop ${new Date().toISOString()}`;
  const a = "Respuesta smoke: usar tools nativas; no inventar precios.";
  const createRes = await fetch(`${base}/api/workspace/change-requests`, {
    method: "POST",
    headers,
    body: JSON.stringify({ type: "knowledge", title: q, question: q, goodAnswer: a }),
  });
  const created = await createRes.json().catch(() => ({}));
  if (!createRes.ok || !created.ok) {
    console.error("CREATE_FAIL", createRes.status, created);
    process.exit(1);
  }
  const id = created.changeRequest?.id;
  const apprRes = await fetch(`${base}/api/workspace/change-requests/${id}/approve`, {
    method: "POST",
    headers,
    body: "{}",
  });
  const appr = await apprRes.json().catch(() => ({}));
  if (!apprRes.ok || !appr.ok || !appr.bmcKbId) {
    console.error("APPROVE_FAIL", apprRes.status, appr);
    process.exit(1);
  }
  const matchRes = await fetch(
    `${base}/api/agent/training-kb/match?q=${encodeURIComponent(q.slice(0, 48))}`,
    { headers: { Authorization: `Bearer ${login.accessToken}` } },
  );
  const match = await matchRes.json().catch(() => ({}));
  const hit = (match.matches || []).some((m) => m.id === appr.bmcKbId);
  console.log(
    JSON.stringify(
      {
        ok: true,
        crId: id,
        knowledgeDocId: created.knowledgeDocId,
        bmcKbId: appr.bmcKbId,
        matchHit: hit,
        matchHttp: matchRes.status,
      },
      null,
      2,
    ),
  );
  if (!hit) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
