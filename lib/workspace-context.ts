import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase';

export async function workspaceContext() {
  const db = await supabase();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { db, user: null, workspace: null, memberships: [] as any[] };

  const { data, error } = await db
    .from('workspace_members')
    .select('workspace_id,role,email,workspaces(id,name,owner_user_id)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true });

  if (error) throw new Error('ワークスペースを読み込めませんでした');

  const memberships = (data || []).map((row: any) => ({
    id: row.workspace_id,
    role: row.role,
    email: row.email,
    name: row.workspaces?.name || 'ワークスペース',
    owner_user_id: row.workspaces?.owner_user_id,
  }));
  const cookieStore = await cookies();
  const activeId = cookieStore.get('ses-match-workspace')?.value;
  const workspace = memberships.find((item: any) => item.id === activeId) || memberships[0] || null;

  return { db, user, workspace, memberships };
}
