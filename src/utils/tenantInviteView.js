/** Invite row copy for BMC admin. claimed_at is the only accept signal. */
export function memberInviteView(m) {
  const email = m?.invited_email || "";
  const sentAt = m?.created_at || null;
  const acceptedAt = m?.claimed_at || null;
  if (acceptedAt) {
    return {
      email,
      accepted: true,
      label: "Invitación aceptada",
      name: m?.name || null,
      role: m?.role || "user",
      sent_at: sentAt,
      accepted_at: acceptedAt,
    };
  }
  return {
    email,
    accepted: false,
    label: "Invitación no aceptada",
    name: null,
    role: m?.role || "user",
    sent_at: sentAt,
    accepted_at: null,
  };
}

export function looksLikeIp(value) {
  const s = String(value || "");
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(s)) return true;
  if (s.includes(":") && /^[0-9a-fA-F:.]+$/.test(s)) return true;
  return false;
}

export function displayPerson({ who, name, email, ip } = {}) {
  const em = (email && String(email).includes("@"))
    ? String(email)
    : (who && String(who).includes("@") ? String(who) : null);
  if (name) return { title: String(name), subtitle: em, visitor: false };
  if (em) return { title: em, subtitle: null, visitor: false };
  const hint = ip || (looksLikeIp(who) ? who : null);
  return { title: "Visitante no identificado", subtitle: hint ? `IP ${hint}` : null, visitor: true };
}
