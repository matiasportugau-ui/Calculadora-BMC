// ═══════════════════════════════════════════════════════════════════════════
// src/components/hub/canales/panels/WaInboxPanel.jsx
// ───────────────────────────────────────────────────────────────────────────
// WA Inbox panel — the unified Omni inbox scoped to the WhatsApp channel.
// Reuses OmniInboxPanel with lockedChannel="wa" so it shares the Canales grant
// and the token already passed in (no nested auth gate), and gets thread view,
// reply and AI assist for free. The full WhatsApp cockpit (Cloud API send,
// cotizador, follow-ups) lives at its own /hub/wa route for power users.
//
// Channel value is "wa" (canonical in omniFormat.js CHANNEL_META and the
// backend `c.channel = 'wa'`), not "whatsapp".
// ═══════════════════════════════════════════════════════════════════════════

import React from "react";
import OmniInboxPanel from "./OmniInboxPanel.jsx";

export default function WaInboxPanel({ token }) {
  return <OmniInboxPanel token={token} lockedChannel="wa" />;
}
