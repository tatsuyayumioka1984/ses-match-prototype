import {NextResponse} from 'next/server';import {supabase} from '@/lib/supabase';
export async function POST(req:Request){const form=await req.formData();const email=String(form.get('email')??'').trim();const db=await supabase();const {error}=await db.auth.signInWithOtp({email});return NextResponse.redirect(new URL(error?'/login?error=send':'/login?sent=1',req.url),303)}
