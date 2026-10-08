import { NextResponse } from 'next/server';
import { z } from 'zod';
import { workspaceContext } from '@/lib/workspace-context';

export async function PATCH(req: Request) {
  const { db, user, workspace } = await workspaceContext();
  if (!user) return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: 'ワークスペースがありません' }, { status: 404 });
  if (workspace.role !== 'admin') return NextResponse.json({ error: '管理者のみ権限を変更できます' }, { status: 403 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: '入力内容を確認してください' }, { status: 400 }); }
  const parsed = z.object({ user_id: z.string().uuid(), role: z.enum(['admin', 'member']) }).safeParse(body);
  if (!parsed.success || parsed.data.user_id === user.id || parsed.data.user_id === workspace.owner_user_id) {
    return NextResponse.json({ error: '変更するメンバーを確認してください' }, { status: 400 });
  }
  if (parsed.data.role === 'member') {
    const { count, error } = await db.from('workspace_members').select('user_id', { count: 'exact', head: true })
      .eq('workspace_id', workspace.id).eq('role', 'admin');
    if (error) return NextResponse.json({ error: '管理者数を確認できませんでした' }, { status: 500 });
    if (count === 1) return NextResponse.json({ error: '管理者がいなくなるため変更できません' }, { status: 400 });
  }
  const { error } = await db.from('workspace_members').update({ role: parsed.data.role })
    .eq('workspace_id', workspace.id).eq('user_id', parsed.data.user_id);
  if (error) return NextResponse.json({ error: '権限を変更できませんでした' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
