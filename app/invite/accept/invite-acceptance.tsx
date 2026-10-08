'use client';

import { useState } from 'react';

export default function InviteAcceptance({ token, email }: { token: string; email: string }) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function accept() {
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/workspaces/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '招待を承認できませんでした');
      window.location.assign('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : '招待を承認できませんでした');
      setSaving(false);
    }
  }

  return <main className="invite-page">
    <small>SES MATCH WORKSPACE</small>
    <h1>ワークスペースへの招待</h1>
    <p>ログイン中のメールアドレス <strong>{email || '不明'}</strong> で招待を承認します。</p>
    <p>招待先と異なるメールアドレスの場合は、いったんログアウトして招待先のアドレスでログインしてください。</p>
    {error && <p className="invite-error" role="alert">{error}</p>}
    <button className="primary" disabled={saving || token.length !== 64} onClick={accept}>
      {saving ? '参加しています…' : 'ワークスペースに参加'}
    </button>
  </main>;
}
