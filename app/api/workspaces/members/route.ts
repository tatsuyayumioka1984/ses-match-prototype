import { NextResponse } from 'next/server';
import { workspaceContext } from '@/lib/workspace-context';

export async function GET() {
  const { db, user, workspace } = await workspaceContext();
  if (!user) return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: 'ワークスペースがありません' }, { status: 404 });
  const { data: members, error } = await db.from('workspace_members')
    .select('user_id,email,role,joined_at')
    .eq('workspace_id', workspace.id)
    .order('joined_at', { ascending: true });
  if (error) return NextResponse.json({ error: 'メンバーを取得できませんでした' }, { status: 500 });
  let invitations: any[] = [];
  if (workspace.role === 'admin') {
    const result = await db.from('workspace_invitations')
      .select('id,email,role,expires_at,created_at')
      .eq('workspace_id', workspace.id)
      .is('accepted_at', null)
      .order('created_at', { ascending: false });
    if (result.error) return NextResponse.json({ error: '招待を取得できませんでした' }, { status: 500 });
    invitations = result.data || [];
  }
  return NextResponse.json({ workspace, members: members || [], invitations });
}
