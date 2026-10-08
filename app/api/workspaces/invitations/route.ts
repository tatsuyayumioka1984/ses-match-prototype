import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { workspaceContext } from '@/lib/workspace-context';

export async function POST(req: Request) {
  const { db, user, workspace } = await workspaceContext();
  if (!user) return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: 'ワークスペースがありません' }, { status: 404 });
  if (workspace.role !== 'admin') return NextResponse.json({ error: '管理者のみメンバーを招待できます' }, { status: 403 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: '入力内容を確認してください' }, { status: 400 }); }
  const parsed = z.object({ email: z.string().trim().email().max(254), role: z.enum(['admin', 'member']).default('member') }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'メールアドレスと権限を確認してください' }, { status: 400 });
  const email = parsed.data.email.toLowerCase();
  const { data: existing } = await db.from('workspace_members').select('user_id').eq('workspace_id', workspace.id).eq('email', email).maybeSingle();
  if (existing) return NextResponse.json({ error: 'このメールアドレスはすでにメンバーです' }, { status: 409 });
  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const { error } = await db.from('workspace_invitations').insert({
    workspace_id: workspace.id,
    email,
    role: parsed.data.role,
    token_hash: tokenHash,
    invited_by: user.id,
  });
  if (error) return NextResponse.json({ error: '招待リンクを作成できませんでした' }, { status: 500 });
  const origin = new URL(req.url).origin;
  return NextResponse.json({ invite_url: new URL('/invite/accept?token=' + token, origin).toString() }, { status: 201 });
}

export async function DELETE(req: Request) {
  const { db, user, workspace } = await workspaceContext();
  if (!user) return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: 'ワークスペースがありません' }, { status: 404 });
  if (workspace.role !== 'admin') return NextResponse.json({ error: '管理者のみ招待を取り消せます' }, { status: 403 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: '入力内容を確認してください' }, { status: 400 }); }
  const parsed = z.object({ id: z.string().uuid() }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: '招待を確認してください' }, { status: 400 });
  const { error } = await db.from('workspace_invitations').delete()
    .eq('id', parsed.data.id).eq('workspace_id', workspace.id);
  if (error) return NextResponse.json({ error: '招待を取り消せませんでした' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
