// Vercel serverless: accept web-vitals beacons from the SPA (App.jsx sendBeacon).
// sendBeacon uses POST with Content-Type text/plain and a JSON body string.

export default function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // No persistence for now — silencing console/network errors in prod is the main goal.
  return res.status(204).end();
}
