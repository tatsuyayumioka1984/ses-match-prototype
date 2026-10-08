import { NextResponse } from 'next/server';
import { z } from 'zod';
import { workspaceContext } from '@/lib/workspace-context';

export async function POST(req: Request) {
  const { user, memberships } = await workspaceContext();
  if (!user) return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: '入力内容を確認してください' }, { status: 400 }); }
  const parsed = z.object({ workspace_id: z.string().uuid() }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'ワークスペースを選択してください' }, { status: 400 });
  const workspace = memberships.find((item: any) => item.id === parsed.data.workspace_id);
  if (!workspace) return NextResponse.json({ error: 'このワークスペースのメンバーではありません' }, { status: 403 });
  const response = NextResponse.json({ workspace });
  response.cookies.set('ses-match-workspace', workspace.id, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 });
  return response;
}
