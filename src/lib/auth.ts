import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from './supabase-server';

// Get current authenticated user or return null
export async function getUser() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

// Get current user's profile (with role)
export async function getUserProfile() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return profile;
}

// Require authentication — returns user or 401 response
export async function requireAuth() {
  const user = await getUser();
  if (!user) {
    return { user: null, response: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) };
  }
  return { user, response: null };
}

// Require admin role — returns profile or 403 response
export async function requireAdmin() {
  const profile = await getUserProfile();
  if (!profile) {
    return { profile: null, response: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) };
  }
  if (profile.role !== 'admin') {
    return { profile: null, response: NextResponse.json({ error: 'Accès interdit' }, { status: 403 }) };
  }
  return { profile, response: null };
}
