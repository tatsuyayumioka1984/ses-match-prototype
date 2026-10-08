import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST() {
  const db = await supabase();
  const { error } = await db.auth.signOut({ scope: 'local' });

  if (error) {
    return NextResponse.json({ error: 'ログアウトできませんでした。時間をおいて再度お試しください。' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
