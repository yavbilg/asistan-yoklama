const SECRET = "yoklama-sakaryapsik-2026";
const TOKEN_INTERVAL = 40000; // 40 saniye

function getTimeSlot(offsetSlots = 0): number {
  return Math.floor(Date.now() / TOKEN_INTERVAL) + offsetSlots;
}

function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  const positive = hash >>> 0;
  return positive.toString(36).padStart(7, "0").slice(0, 7);
}

export function generateToken(sessionId: string): string {
  const slot = getTimeSlot();
  return simpleHash(`${SECRET}-${sessionId}-${slot}`);
}

export function validateToken(sessionId: string, token: string): boolean {
  for (let offset = 0; offset >= -2; offset--) {
    const slot = getTimeSlot(offset);
    const expected = simpleHash(`${SECRET}-${sessionId}-${slot}`);
    if (token === expected) return true;
  }
  return false;
}

export function getSecondsRemaining(): number {
  const now = Date.now();
  const nextSlot = (Math.floor(now / TOKEN_INTERVAL) + 1) * TOKEN_INTERVAL;
  return Math.ceil((nextSlot - now) / 1000);
}
