import { supabase } from "@/integrations/supabase/client";
import { clearPendingInvite, readPendingInvite } from "@/lib/pendingInvite";

export const GROUPS_UPDATED_EVENT = "study-arena:groups-updated";

export function notifyGroupsUpdated() {
  window.dispatchEvent(new Event(GROUPS_UPDATED_EVENT));
}

/**
 * Joins the group behind the pending invite (if any) and always clears it afterward.
 * Returns the path to navigate to, or null if there was no pending invite.
 */
export async function resolvePendingInvite(): Promise<string | null> {
  const pending = readPendingInvite();
  if (!pending) return null;

  try {
    const { data, error } = await supabase.rpc("join_group_via_invite_link", { p_token: pending.token });
    if (error) throw error;
    notifyGroupsUpdated();
    return `/groups/${data ?? pending.groupId}`;
  } catch {
    return `/join/${pending.token}`;
  } finally {
    clearPendingInvite();
  }
}
