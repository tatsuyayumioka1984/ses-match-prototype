import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

function safeNext(value: string | null) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values: { name: string; value: string; options: CookieOptions }[]) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await client.auth.getUser();
  if (!user && request.nextUrl.pathname !== '/login') {
    const target = request.nextUrl.clone();
    const next = target.pathname + target.search;
    target.pathname = '/login';
    target.search = '';
    target.searchParams.set('next', next);
    return NextResponse.redirect(target);
  }
  if (user && request.nextUrl.pathname === '/login') {
    const target = request.nextUrl.clone();
    target.pathname = safeNext(target.searchParams.get('next'));
    target.search = '';
    return NextResponse.redirect(target);
  }
  return response;
}

// Auth callback and magic-link routes must remain reachable before a session exists.
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|api/|auth/).*)'] };
