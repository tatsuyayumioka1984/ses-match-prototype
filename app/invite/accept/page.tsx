import { supabase } from '@/lib/supabase';
import InviteAcceptance from './invite-acceptance';

export default async function AcceptInvitation({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  const db = await supabase();
  const { data: { user } } = await db.auth.getUser();
  return <InviteAcceptance token={params.token || ''} email={user?.email || ''} />;
}
