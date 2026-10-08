import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function safeNext(value: string) {
  return value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

export async function POST(req: Request) {
  const form = await req.formData();
  const email = String(form.get('email') ?? '').trim();
  const token = String(form.get('token') ?? '').trim();
  const next = safeNext(String(form.get('next') ?? '/'));
  const db = await supabase();
  const { error } = await db.auth.verifyOtp({ email, token, type: 'email' });
  if (error) {
    const login = new URL('/login', req.url);
    login.searchParams.set('error', 'verify');
    if (next !== '/') login.searchParams.set('next', next);
    return NextResponse.redirect(login, 303);
  }
  return NextResponse.redirect(new URL(next, req.url), 303);
}
