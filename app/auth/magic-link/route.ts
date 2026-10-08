import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function safeNext(value: string) {
  return value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

export async function POST(req: Request) {
  const form = await req.formData();
  const email = String(form.get('email') ?? '').trim();
  const next = safeNext(String(form.get('next') ?? '/'));
  const callback = new URL('/auth/callback', req.url);
  callback.searchParams.set('next', next);
  const db = await supabase();
  const { error } = await db.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callback.toString() },
  });
  const login = new URL('/login', req.url);
  login.searchParams.set(error ? 'error' : 'sent', error ? 'send' : '1');
  if (next !== '/') login.searchParams.set('next', next);
  return NextResponse.redirect(login, 303);
}
