import { NextResponse } from 'next/server';
import { z } from 'zod';
import { workspaceContext } from '@/lib/workspace-context';

export async function POST(req: Request) {
  const { db, user, workspace } = await workspaceContext();
  if (!user) return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: 'ワークスペースがありません' }, { status: 404 });
  if (workspace.role !== 'admin') return NextResponse.json({ error: '管理者のみメンバーを削除できます' }, { status: 403 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: '入力内容を確認してください' }, { status: 400 }); }
  const parsed = z.object({ user_id: z.string().uuid() }).safeParse(body);
  if (!parsed.success || parsed.data.user_id === user.id) return NextResponse.json({ error: '削除するメンバーを確認してください' }, { status: 400 });
  const { data: member, error: lookupError } = await db.from('workspace_members').select('user_id,role')
    .eq('workspace_id', workspace.id).eq('user_id', parsed.data.user_id).maybeSingle();
  if (lookupError) return NextResponse.json({ error: 'メンバーを確認できませんでした' }, { status: 500 });
  if (!member || parsed.data.user_id === workspace.owner_user_id) return NextResponse.json({ error: 'このメンバーは削除できません' }, { status: 400 });
  const { error } = await db.from('workspace_members').delete().eq('workspace_id', workspace.id).eq('user_id', parsed.data.user_id);
  if (error) return NextResponse.json({ error: 'メンバーを削除できませんでした' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
