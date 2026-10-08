import { NextResponse } from 'next/server';
import { z } from 'zod';
import { workspaceContext } from '@/lib/workspace-context';

export async function GET() {
  try {
    const { user, workspace, memberships } = await workspaceContext();
    if (!user) return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
    if (!workspace) return NextResponse.json({ error: 'ワークスペースがありません' }, { status: 404 });
    return NextResponse.json({ user_id: user.id, workspace, workspaces: memberships });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'ワークスペースを取得できませんでした' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { db, user, workspace } = await workspaceContext();
    if (!user) return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
    if (!workspace) return NextResponse.json({ error: 'ワークスペースがありません' }, { status: 404 });
    if (workspace.role !== 'admin') return NextResponse.json({ error: '管理者のみワークスペース名を変更できます' }, { status: 403 });
    const parsed = z.object({ name: z.string().trim().min(1).max(80) }).safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'ワークスペース名は1〜80文字で入力してください' }, { status: 400 });
    const { data, error } = await db.from('workspaces').update({ name: parsed.data.name }).eq('id', workspace.id).select('id,name').single();
    if (error) return NextResponse.json({ error: 'ワークスペース名を保存できませんでした' }, { status: 500 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: '入力内容を確認してください' }, { status: 400 });
  }
}
