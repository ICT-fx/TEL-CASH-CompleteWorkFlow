import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth';

// GET /api/admin/notifications — counts for sidebar pills
// pending_orders: paid orders not yet shipped (= action needed: expédier)
// pending_returns: return requests still requiring admin action
export async function GET() {
  const { profile, response } = await requireAdmin();
  if (response) return response;

  const supabase = createAdminClient();

  const [{ count: pendingOrders }, { count: pendingReturns }] = await Promise.all([
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'paid'),
    supabase
      .from('return_requests')
      .select('id', { count: 'exact', head: true })
      .in('status', ['requested', 'received', 'inspecting']),
  ]);

  return NextResponse.json({
    pending_orders: pendingOrders || 0,
    pending_returns: pendingReturns || 0,
  });
}
