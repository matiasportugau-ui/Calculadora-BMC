// Artifact stub for src/components/auth/AuthGateModal.jsx
// In design-environment mode the user is always considered authenticated,
// so the modal renders nothing and requestAuthGate is a no-op.

export default function AuthGateModal() {
  return null;
}

export function requestAuthGate() {
  // No-op: artifact mode is permanently authenticated.
}
