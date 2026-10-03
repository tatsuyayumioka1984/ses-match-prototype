import {NextResponse} from 'next/server';
import {supabase} from '@/lib/supabase';

export async function POST(req:Request){
  const form=await req.formData();
  const email=String(form.get('email')??'').trim();
  const token=String(form.get('token')??'').trim();
  const db=await supabase();
  const {error}=await db.auth.verifyOtp({email,token,type:'email'});
  if(error)return NextResponse.redirect(new URL('/login?error=verify',req.url),303);
  return NextResponse.redirect(new URL('/',req.url),303);
}
