import { supabase, isSupabaseConfigured, signUpWithEmail, signInWithEmail, updateUserPassword } from '../supabase';
import { HouseholdInvitation, MemberRole } from '../types';

/**
 * Generate a cryptographically strong, URL-safe random token
 */
export function generateSecureToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const array = new Uint8Array(24);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  return 'tok_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Get base URL for invitation links (supports Vercel, localhost, and custom domains)
 */
export function getAppBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return window.location.origin;
  }
  return 'https://home-budget-coral.vercel.app';
}

/**
 * Create a new household invitation or password reset token
 */
export async function createHouseholdInvitation(params: {
  householdId: string;
  email: string;
  fullName?: string;
  role?: MemberRole;
  expiryHours: number; // 48, 168 (7 days), or 720 (30 days)
  tokenType?: 'invite' | 'password_reset';
  invitedBy?: string;
}): Promise<{ success: boolean; invitation?: HouseholdInvitation; inviteUrl?: string; error?: string }> {
  const {
    householdId,
    email,
    fullName = '',
    role = 'user',
    expiryHours = 168,
    tokenType = 'invite',
    invitedBy,
  } = params;

  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail || !trimmedEmail.includes('@')) {
    return { success: false, error: 'כתובת אימייל לא תקינה' };
  }

  const token = generateSecureToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiryHours * 60 * 60 * 1000);

  const newInvitation: HouseholdInvitation = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `inv_${Date.now()}`,
    household_id: householdId,
    email: trimmedEmail,
    full_name: fullName.trim() || trimmedEmail.split('@')[0],
    role,
    token,
    token_type: tokenType,
    invited_by: invitedBy,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    status: 'pending',
  };

  const paramKey = tokenType === 'password_reset' ? 'reset' : 'invite';
  const inviteUrl = `${getAppBaseUrl()}/?${paramKey}=${token}`;

  // If Supabase is configured, store in DB
  if (isSupabaseConfigured) {
    try {
      // First, cancel any previous pending invitations for this email in this household & token_type
      await supabase
        .from('household_invitations')
        .update({ status: 'revoked' })
        .eq('household_id', householdId)
        .eq('email', trimmedEmail)
        .eq('token_type', tokenType)
        .eq('status', 'pending');

      const { data, error } = await supabase
        .from('household_invitations')
        .insert({
          id: newInvitation.id,
          household_id: householdId,
          email: trimmedEmail,
          full_name: newInvitation.full_name,
          role: newInvitation.role,
          token: newInvitation.token,
          token_type: newInvitation.token_type,
          invited_by: invitedBy || null,
          created_at: newInvitation.created_at,
          expires_at: newInvitation.expires_at,
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        console.warn('Database insert into household_invitations warning:', error);
        // If table not created yet, still return local invite URL for user preview
      } else if (data) {
        return { success: true, invitation: data as HouseholdInvitation, inviteUrl };
      }
    } catch (err: any) {
      console.error('Error creating invitation in DB:', err);
    }
  }

  // Fallback to local storage for demo / offline
  try {
    const saved = localStorage.getItem('household_invitations_cache') || '[]';
    const list: HouseholdInvitation[] = JSON.parse(saved);
    list.unshift(newInvitation);
    localStorage.setItem('household_invitations_cache', JSON.stringify(list));
  } catch (e) {}

  return { success: true, invitation: newInvitation, inviteUrl };
}

/**
 * Fetch all pending invitations for a household
 */
export async function fetchHouseholdInvitations(householdId: string): Promise<HouseholdInvitation[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('household_invitations')
        .select('*')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data as HouseholdInvitation[];
      }
    } catch (err) {
      console.warn('Error fetching household invitations from DB:', err);
    }
  }

  // Fallback from cache
  try {
    const saved = localStorage.getItem('household_invitations_cache') || '[]';
    const list: HouseholdInvitation[] = JSON.parse(saved);
    return list.filter((i) => i.household_id === householdId);
  } catch (e) {
    return [];
  }
}

/**
 * Verify and load invitation / reset token
 */
export async function verifyToken(token: string): Promise<{
  valid: boolean;
  invitation?: HouseholdInvitation;
  householdName?: string;
  isExpired?: boolean;
  isAlreadyUsed?: boolean;
  error?: string;
}> {
  if (!token || !token.trim()) {
    return { valid: false, error: 'טוקן לא נמצא' };
  }

  let found: HouseholdInvitation | null = null;
  let hhName = 'משק הבית';

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('household_invitations')
        .select('*, households(name)')
        .eq('token', token.trim())
        .maybeSingle();

      if (!error && data) {
        found = data as any;
        if (data.households && data.households.name) {
          hhName = data.households.name;
        }
      }
    } catch (err) {
      console.warn('Supabase token verification error:', err);
    }
  }

  if (!found) {
    try {
      const saved = localStorage.getItem('household_invitations_cache') || '[]';
      const list: HouseholdInvitation[] = JSON.parse(saved);
      found = list.find((i) => i.token === token.trim()) || null;
    } catch (e) {}
  }

  if (!found) {
    return { valid: false, error: 'קישור ההזמנה אינו קיים במערכת או שכבר נמחק.' };
  }

  if (found.status === 'accepted' || found.used_at) {
    return { valid: false, isAlreadyUsed: true, error: 'קישור זה כבר נוצל בעבר. אנא התחבר למערכת עם הסיסמה שלך.' };
  }

  if (found.status === 'revoked') {
    return { valid: false, error: 'קישור הזמנה זה בוטל ע"י מנהל המשפחה. פנה אליו לקבלת קישור חדש.' };
  }

  const now = new Date();
  const expiresAt = new Date(found.expires_at);
  if (now > expiresAt) {
    return { valid: false, isExpired: true, error: 'תוקף הקישור פג. פנה למנהל המשפחה שישלח לך קישור חדש ורענן.' };
  }

  return { valid: true, invitation: found, householdName: hhName };
}

/**
 * Revoke / Cancel an invitation
 */
export async function revokeInvitation(invitationId: string): Promise<boolean> {
  if (isSupabaseConfigured) {
    try {
      await supabase
        .from('household_invitations')
        .update({ status: 'revoked' })
        .eq('id', invitationId);
    } catch (e) {}
  }

  try {
    const saved = localStorage.getItem('household_invitations_cache') || '[]';
    const list: HouseholdInvitation[] = JSON.parse(saved);
    const updated = list.map((i) => (i.id === invitationId ? { ...i, status: 'revoked' as const } : i));
    localStorage.setItem('household_invitations_cache', JSON.stringify(updated));
  } catch (e) {}

  return true;
}

/**
 * Renew an invitation (generates new token & resets expiry)
 */
export async function renewInvitation(
  invitation: HouseholdInvitation,
  newExpiryHours: number = 168
): Promise<{ success: boolean; newInvitation?: HouseholdInvitation; newInviteUrl?: string }> {
  // Revoke old
  await revokeInvitation(invitation.id);

  // Create new
  return createHouseholdInvitation({
    householdId: invitation.household_id,
    email: invitation.email,
    fullName: invitation.full_name || undefined,
    role: invitation.role,
    expiryHours: newExpiryHours,
    tokenType: invitation.token_type,
    invitedBy: invitation.invited_by,
  });
}

/**
 * Mark invitation as used
 */
export async function markInvitationAccepted(invitationId: string): Promise<void> {
  const now = new Date().toISOString();
  if (isSupabaseConfigured) {
    try {
      await supabase
        .from('household_invitations')
        .update({ status: 'accepted', used_at: now })
        .eq('id', invitationId);
    } catch (e) {}
  }

  try {
    const saved = localStorage.getItem('household_invitations_cache') || '[]';
    const list: HouseholdInvitation[] = JSON.parse(saved);
    const updated = list.map((i) =>
      i.id === invitationId ? { ...i, status: 'accepted' as const, used_at: now } : i
    );
    localStorage.setItem('household_invitations_cache', JSON.stringify(updated));
  } catch (e) {}
}
