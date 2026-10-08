import { NextResponse } from 'next/server';
import { z } from 'zod';
import { workspaceContext } from '@/lib/workspace-context';

const score = z.number().int().min(0).max(100);

function latestMatchResults(items: any[] | null) {
  return [...(items || [])].sort((a, b) => Date.parse(b.created_at || '') - Date.parse(a.created_at || '')).slice(0, 1);
}
const schema = z.object({
  title: z.string().min(1),
  source_text: z.string().default(''),
  source_file_path: z.string().nullable().optional(),
  requirements: z.unknown().default({}),
  rate: z.number().int().nullable().optional(),
  location: z.string().nullable().optional(),
  work_style: z.string().nullable().optional(),
  sales_contact: z.string().nullable().optional(),
  analysis: z.object({
    total_score: score,
    tech_score: score,
    experience_score: score,
    career_score: score,
    detail: z.unknown(),
  }).optional(),
});

export async function GET(req: Request) {
  const { db, user, workspace } = await workspaceContext();
  if (!user) return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: 'ワークスペースがありません' }, { status: 404 });

  const projectId = new URL(req.url).searchParams.get('id');
  if (projectId) {
    const parsedId = z.string().uuid().safeParse(projectId);
    if (!parsedId.success) return NextResponse.json({ error: '案件を確認してください' }, { status: 400 });
    const { data, error } = await db.from('projects')
      .select('id,title,source_text,requirements,created_at,status,rate,location,work_style,sales_contact,match_results(total_score,tech_score,experience_score,career_score,detail,created_at)')
      .eq('id', parsedId.data).eq('workspace_id', workspace.id).maybeSingle();
    if (error) return NextResponse.json({ error: '案件を取得できませんでした' }, { status: 500 });
    if (!data) return NextResponse.json({ error: '案件が見つかりません' }, { status: 404 });
    return NextResponse.json({ ...data, match_results: latestMatchResults(data.match_results) });
  }

  const { data, error } = await db
    .from('projects')
    .select('id,title,created_at,status,rate,match_results(total_score)')
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: '案件を取得できませんでした' }, { status: 500 });
  return NextResponse.json((data || []).map((project: any) => ({ ...project, match_results: latestMatchResults(project.match_results) })));
}

export async function POST(req: Request) {
  const { db, user, workspace } = await workspaceContext();
  if (!user) return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: 'ワークスペースがありません' }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '送信データを読み取れませんでした' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: '案件情報を確認してください' }, { status: 400 });

  const { analysis, ...projectFields } = parsed.data;
  const { data: project, error } = await db
    .from('projects')
    .insert({ ...projectFields, user_id: user.id, workspace_id: workspace.id })
    .select()
    .single();
  if (error) return NextResponse.json({ error: '案件を保存できませんでした' }, { status: 500 });

  if (analysis) {
    const { error: matchError } = await db.from('match_results').insert({
      project_id: project.id,
      user_id: user.id,
      total_score: analysis.total_score,
      tech_score: analysis.tech_score,
      experience_score: analysis.experience_score,
      career_score: analysis.career_score,
      detail: analysis.detail,
    });
    if (matchError) {
      await db.from('projects').delete().eq('id', project.id).eq('workspace_id', workspace.id);
      return NextResponse.json({ error: '案件は保存できましたが、分析結果を保存できませんでした。もう一度お試しください' }, { status: 500 });
    }
  }
  return NextResponse.json(project, { status: 201 });
}

const projectStatus = z.enum(['proposed', 'interview_scheduled', 'interview_completed', 'offer', 'rejected']);

export async function DELETE(req: Request) {
  const { db, user, workspace } = await workspaceContext();
  if (!user) return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: 'ワークスペースがありません' }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '送信データを読み取れませんでした' }, { status: 400 });
  }
  const parsed = z.object({ id: z.string().uuid() }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: '削除する案件を確認してください' }, { status: 400 });

  const { data: target, error: targetError } = await db.from('projects').select('id,user_id')
    .eq('id', parsed.data.id).eq('workspace_id', workspace.id).maybeSingle();
  if (targetError) return NextResponse.json({ error: '案件を確認できませんでした' }, { status: 500 });
  if (!target) return NextResponse.json({ error: '案件が見つかりません' }, { status: 404 });
  if (target.user_id !== user.id && workspace.role !== 'admin') return NextResponse.json({ error: '作成者または管理者のみ案件を削除できます' }, { status: 403 });
  const { data, error } = await db
    .from('projects')
    .delete()
    .eq('id', parsed.data.id)
    .eq('workspace_id', workspace.id)
    .select('id')
    .maybeSingle();
  if (error) return NextResponse.json({ error: '案件を削除できませんでした' }, { status: 500 });
  if (!data) return NextResponse.json({ error: '案件が見つからないか、削除する権限がありません' }, { status: 404 });
  return NextResponse.json({ id: data.id });
}

export async function PATCH(req: Request) {
  const { db, user, workspace } = await workspaceContext();
  if (!user) return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
  if (!workspace) return NextResponse.json({ error: 'ワークスペースがありません' }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '送信データを読み取れませんでした' }, { status: 400 });
  }
  const parsed = z.object({
    id: z.string().uuid(),
    status: projectStatus.optional(),
    analysis: schema.shape.analysis.optional(),
  }).refine((value) => value.status !== undefined || value.analysis !== undefined).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: '案件の変更内容を確認してください' }, { status: 400 });

  if (parsed.data.status) {
    const { error } = await db
      .from('projects')
      .update({ status: parsed.data.status })
      .eq('id', parsed.data.id)
      .eq('workspace_id', workspace.id);
    if (error) return NextResponse.json({ error: 'ステータスを保存できませんでした' }, { status: 500 });
  }

  if (parsed.data.analysis) {
    const { data: ownedProject, error: ownerError } = await db.from('projects').select('id')
      .eq('id', parsed.data.id).eq('workspace_id', workspace.id).maybeSingle();
    if (ownerError) return NextResponse.json({ error: '案件を確認できませんでした' }, { status: 500 });
    if (!ownedProject) return NextResponse.json({ error: '案件が見つかりません' }, { status: 404 });
    const { data: existing, error: existingError } = await db.from('match_results').select('id')
      .eq('project_id', parsed.data.id).eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (existingError) return NextResponse.json({ error: '既存の分析結果を確認できませんでした' }, { status: 500 });
    const values = {
      total_score: parsed.data.analysis.total_score,
      tech_score: parsed.data.analysis.tech_score,
      experience_score: parsed.data.analysis.experience_score,
      career_score: parsed.data.analysis.career_score,
      detail: parsed.data.analysis.detail,
    };
    const { error } = existing
      ? await db.from('match_results').update(values).eq('id', existing.id).eq('user_id', user.id)
      : await db.from('match_results').insert({ ...values, project_id: parsed.data.id, user_id: user.id });
    if (error) return NextResponse.json({ error: '分析結果を保存できませんでした' }, { status: 500 });
  }

  const { data, error } = await db.from('projects')
    .select('id,title,created_at,status,rate,match_results(total_score)')
    .eq('id', parsed.data.id).eq('workspace_id', workspace.id).single();
  if (error) return NextResponse.json({ error: '案件を取得できませんでした' }, { status: 500 });
  return NextResponse.json(data);
}
