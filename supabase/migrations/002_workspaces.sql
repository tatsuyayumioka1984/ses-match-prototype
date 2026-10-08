create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  token_hash text not null unique,
  invited_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index workspace_members_user on public.workspace_members(user_id);
create index workspace_invitations_workspace on public.workspace_invitations(workspace_id, created_at desc);

alter table public.projects add column workspace_id uuid references public.workspaces(id) on delete cascade;

insert into public.workspaces(name, owner_user_id)
select '個人ワークスペース', u.id
from auth.users u
where not exists (select 1 from public.workspace_members m where m.user_id = u.id);

insert into public.workspace_members(workspace_id, user_id, email, role)
select w.id, w.owner_user_id, lower(coalesce(u.email, '')), 'admin'
from public.workspaces w
join auth.users u on u.id = w.owner_user_id
where not exists (
  select 1 from public.workspace_members m
  where m.workspace_id = w.id and m.user_id = w.owner_user_id
);

update public.projects p
set workspace_id = m.workspace_id
from public.workspace_members m
where p.user_id = m.user_id and p.workspace_id is null;

alter table public.projects alter column workspace_id set not null;
create index projects_workspace_latest on public.projects(workspace_id, created_at desc);

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = target_workspace and m.user_id = auth.uid()
  );
$$;

revoke all on function public.is_workspace_member(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;

create or replace function public.is_workspace_admin(target_workspace uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = target_workspace and m.user_id = auth.uid() and m.role = 'admin'
  );
$$;

revoke all on function public.is_workspace_admin(uuid) from public;
grant execute on function public.is_workspace_admin(uuid) to authenticated;

create or replace function public.workspace_owner_user_id(target_workspace uuid)
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select w.owner_user_id from public.workspaces w where w.id = target_workspace;
$$;

revoke all on function public.workspace_owner_user_id(uuid) from public;
grant execute on function public.workspace_owner_user_id(uuid) to authenticated;

create or replace function public.create_default_workspace()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare new_workspace uuid;
begin
  insert into public.workspaces(name, owner_user_id)
  values ('個人ワークスペース', new.id)
  returning id into new_workspace;

  insert into public.workspace_members(workspace_id, user_id, email, role)
  values (new_workspace, new.id, lower(coalesce(new.email, '')), 'admin');

  return new;
end;
$$;

create trigger create_default_workspace_after_signup
after insert on auth.users
for each row execute function public.create_default_workspace();

create or replace function public.accept_workspace_invitation(p_token_hash text)
returns table(workspace_id uuid, workspace_name text)
language plpgsql security definer
set search_path = ''
as $$
declare
  invite public.workspace_invitations%rowtype;
  current_email text;
begin
  current_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if auth.uid() is null or current_email = '' then
    raise exception 'ログインが必要です';
  end if;

  select * into invite
  from public.workspace_invitations i
  where i.token_hash = p_token_hash
    and lower(i.email) = current_email
    and i.accepted_at is null
    and i.expires_at > now()
  for update;

  if not found then
    raise exception '招待リンクが無効か期限切れです。管理者に再発行を依頼してください';
  end if;

  insert into public.workspace_members(workspace_id, user_id, email, role)
  values (invite.workspace_id, auth.uid(), current_email, invite.role)
  on conflict (workspace_id, user_id) do nothing;

  update public.workspace_invitations
  set accepted_at = now()
  where id = invite.id;

  return query select w.id, w.name from public.workspaces w where w.id = invite.workspace_id;
end;
$$;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invitations enable row level security;

create policy "workspace members can read workspaces" on public.workspaces
for select using (public.is_workspace_member(id));
create policy "workspace admins can update workspaces" on public.workspaces
for update using (public.is_workspace_admin(id)) with check (public.is_workspace_admin(id));

create policy "workspace members can read memberships" on public.workspace_members
for select using (public.is_workspace_member(workspace_id));
create policy "workspace admins can remove memberships" on public.workspace_members
for delete using (public.is_workspace_admin(workspace_id) and user_id <> public.workspace_owner_user_id(workspace_id) and user_id <> auth.uid());
create policy "workspace admins can update memberships" on public.workspace_members
for update using (public.is_workspace_admin(workspace_id) and user_id <> public.workspace_owner_user_id(workspace_id) and user_id <> auth.uid())
with check (public.is_workspace_admin(workspace_id) and user_id <> public.workspace_owner_user_id(workspace_id) and user_id <> auth.uid());

-- Membership updates may change a role only; workspace/user identity is immutable to clients.
revoke update on public.workspace_members from authenticated;
grant update (role) on public.workspace_members to authenticated;

create policy "workspace admins manage invitations" on public.workspace_invitations
for all using (public.is_workspace_admin(workspace_id))
with check (public.is_workspace_admin(workspace_id));

drop policy if exists "owner access" on public.projects;
create policy "workspace members read projects" on public.projects
for select using (public.is_workspace_member(workspace_id));
create policy "workspace members create projects" on public.projects
for insert with check (public.is_workspace_member(workspace_id) and user_id = auth.uid());
create policy "workspace members update projects" on public.projects
for update using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));
create policy "workspace admins or creators delete projects" on public.projects
for delete using (
  public.is_workspace_member(workspace_id)
  and (user_id = auth.uid() or public.is_workspace_admin(workspace_id))
);

-- Project metadata and ownership stay fixed through the client API; members may update status only.
revoke update on public.projects from authenticated;
grant update (status) on public.projects to authenticated;

drop policy if exists "owner access" on public.match_results;
create policy "workspace members read match results" on public.match_results
for select using (
  exists (select 1 from public.projects p where p.id = project_id and public.is_workspace_member(p.workspace_id))
);
create policy "workspace members create match results" on public.match_results
for insert with check (
  user_id = auth.uid()
  and exists (select 1 from public.projects p where p.id = project_id and public.is_workspace_member(p.workspace_id))
);
create policy "creators update match results" on public.match_results
for update using (
  exists (
    select 1 from public.projects p
    where p.id = project_id
      and public.is_workspace_member(p.workspace_id)
      and user_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  and exists (select 1 from public.projects p where p.id = project_id and public.is_workspace_member(p.workspace_id))
);
revoke update on public.match_results from authenticated;
grant update (total_score, tech_score, experience_score, career_score, detail) on public.match_results to authenticated;
create policy "workspace admins or creator delete match results" on public.match_results
for delete using (
  exists (
    select 1 from public.projects p
    where p.id = project_id
      and public.is_workspace_member(p.workspace_id)
      and (user_id = auth.uid() or public.is_workspace_admin(p.workspace_id))
  )
);

revoke all on function public.accept_workspace_invitation(text) from public;
grant execute on function public.accept_workspace_invitation(text) to authenticated;
