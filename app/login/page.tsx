import {supabase} from '@/lib/supabase';
import type {CSSProperties} from 'react';

const inputStyle:CSSProperties={display:'block',width:'100%',padding:12,margin:'8px 0 16px',border:'1px solid #ccd'};
const buttonStyle:CSSProperties={width:'100%',padding:12,background:'#197c78',color:'white',border:0,borderRadius:6};

export default async function Login({searchParams}:{searchParams:Promise<{error?:string;sent?:string}>}){
  const db=await supabase();
  const {data}=await db.auth.getUser();
  const params=await searchParams;
  const error=params.error;
  const sent=params.sent==='1';

  return <main style={{maxWidth:420,margin:'12vh auto',padding:28,background:'white',border:'1px solid #e8edef',borderRadius:12}}>
    <small style={{color:'#197c78',letterSpacing:2}}>SES MATCH</small>
    <h1>ログイン</h1>
    {data.user?<p>ログイン済みです。トップページを開いてください。</p>:<>
      <p>メールアドレスに届いたログインコードを入力します。</p>
      {error==='send'&&<p style={{color:'#a33'}}>コードを送信できませんでした。メールアドレスとSupabaseの設定を確認してください。</p>}
      {error==='verify'&&<p style={{color:'#a33'}}>コードを確認できませんでした。最新のメールに届いたコードを確認してください。</p>}
      {sent&&<p role="status">ログインコードを送信しました。メールを確認してください。</p>}
      {!sent&&<form action="/auth/magic-link" method="post">
        <label>メールアドレス<input required type="email" name="email" autoComplete="email" style={inputStyle}/></label>
        <button style={buttonStyle}>ログインコードを送る</button>
      </form>}
      {sent&&<form action="/auth/verify-otp" method="post">
        <label>メールアドレス<input required type="email" name="email" autoComplete="email" style={inputStyle}/></label>
        <label>メールに記載されたコード（6〜10桁）<input required type="text" name="token" inputMode="numeric" pattern="[0-9]{6,10}" maxLength={10} autoComplete="one-time-code" style={inputStyle}/></label>
        <button style={buttonStyle}>コードを確認してログイン</button>
      </form>}
    </>}
  </main>;
}
