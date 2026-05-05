import { getWaPool, resetWaPoolForTests } from "../server/lib/waDb.js";
import { initWaWebhooks, emitWaWebhook, _resetWaWebhooksForTests } from "../server/lib/waWebhooks.js";
import { primeWaConfig, setFlag, _resetWaConfigForTests } from "../server/lib/waConfig.js";
import http from "node:http";

const DATABASE_URL = process.env.DATABASE_URL || "postgres://localhost/bmc_wa_local";

async function runTests() {
  console.log("=== WA Webhooks Integration Tests ===");
  const pool = getWaPool(DATABASE_URL);
  
  // Setup a local mock server to receive webhooks
  let received = [];
  const mockServer = http.createServer((req, res) => {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      received.push({
        url: req.url,
        headers: req.headers,
        body: JSON.parse(body)
      });
      res.writeHead(200);
      res.end('{"ok":true}');
    });
  });
  
  await new Promise(r => mockServer.listen(0, "127.0.0.1", r));
  const mockPort = mockServer.address().port;
  const mockUrl = `http://127.0.0.1:${mockPort}/webhook`;

  try {
    await primeWaConfig({ pool });
    initWaWebhooks({ pool });
    
    // Enable webhooks flag
    await setFlag("webhooks.enabled", { enabled: true }, { actor: "test_runner" });

    // 1. Register a webhook in DB
    const secret = "test_webhook_secret";
    await pool.query(
      `insert into wa_webhooks (event, url, secret, enabled)
       values ($1, $2, $3, true)`,
      ["message.in", mockUrl, secret]
    );

    // 2. Emit event
    emitWaWebhook("message.in", { chat_id: "test_chat", text: "hello" });
    
    // Wait for async dispatch
    console.log("→ waiting for webhook dispatch...");
    for (let i = 0; i < 10; i++) {
      if (received.length > 0) break;
      await new Promise(r => setTimeout(r, 500));
    }

    console.log("✓ Webhook Received:", received.length === 1 ? "OK" : "FAIL");
    if (received.length > 0) {
      const wh = received[0];
      console.log("✓ Correct URL:", wh.url === "/webhook" ? "OK" : "FAIL");
      console.log("✓ Correct Event Header:", wh.headers["x-wa-event"] === "message.in" ? "OK" : "FAIL");
      console.log("✓ Has Signature:", !!wh.headers["x-wa-signature"] ? "OK" : "FAIL");
      console.log("✓ Payload Chat ID:", wh.body.payload.chat_id === "test_chat" ? "OK" : "FAIL");
    }

    // Cleanup
    await pool.query("delete from wa_webhooks where url = $1", [mockUrl]);
    await pool.query("delete from wa_audit_log where operator_id = 'test_runner'");
    await pool.query("delete from wa_flags where updated_by = 'test_runner'");
    console.log("✓ Cleanup done");

  } catch (e) {
    console.error("TEST FAILED:", e);
    process.exit(1);
  } finally {
    mockServer.close();
    _resetWaWebhooksForTests();
    _resetWaConfigForTests();
    await resetWaPoolForTests();
  }
  console.log("=== WA Webhooks Tests Passed ===\n");
}

runTests();
