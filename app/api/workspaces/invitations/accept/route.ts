import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  const db = await supabase();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: '招待を受けるにはログインしてください' }, { status: 401 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: '招待リンクを確認してください' }, { status: 400 }); }
  const parsed = z.object({ token: z.string().length(64).regex(/^[a-f0-9]+$/) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: '招待リンクが無効です' }, { status: 400 });
  const tokenHash = createHash('sha256').update(parsed.data.token).digest('hex');
  const { data, error } = await db.rpc('accept_workspace_invitation', { p_token_hash: tokenHash });
  if (error) return NextResponse.json({ error: error.message || '招待を承認できませんでした' }, { status: 400 });
  const joined = Array.isArray(data) ? data[0] : data;
  if (!joined?.workspace_id) return NextResponse.json({ error: 'ワークスペースを確認できませんでした' }, { status: 400 });
  const response = NextResponse.json({ workspace_id: joined.workspace_id, workspace_name: joined.workspace_name });
  response.cookies.set('ses-match-workspace', joined.workspace_id, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 });
  return response;
}
