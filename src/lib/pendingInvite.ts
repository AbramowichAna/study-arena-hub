const KEY = "pendingInvite";

export type PendingInvite = { token: string; groupId: string };

export function savePendingInvite(invite: PendingInvite) {
  sessionStorage.setItem(KEY, JSON.stringify(invite));
}

export function readPendingInvite(): PendingInvite | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.token !== "string" || typeof parsed?.groupId !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingInvite() {
  sessionStorage.removeItem(KEY);
}
