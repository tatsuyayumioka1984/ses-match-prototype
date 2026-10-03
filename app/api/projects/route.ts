import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';

const score = z.number().int().min(0).max(100);
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

export async function GET() {
  const db = await supabase();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });

  const { data, error } = await db
    .from('projects')
    .select('id,title,created_at,status,rate,match_results(total_score)')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: '案件を取得できませんでした' }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const db = await supabase();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });

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
    .insert({ ...projectFields, user_id: user.id })
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
      await db.from('projects').delete().eq('id', project.id).eq('user_id', user.id);
      return NextResponse.json({ error: '案件は保存できましたが、分析結果を保存できませんでした。もう一度お試しください' }, { status: 500 });
    }
  }
  return NextResponse.json(project, { status: 201 });
}

const projectStatus = z.enum(['proposed', 'interview_scheduled', 'interview_completed', 'offer', 'rejected']);

export async function PATCH(req: Request) {
  const db = await supabase();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '送信データを読み取れませんでした' }, { status: 400 });
  }
  const parsed = z.object({ id: z.string().uuid(), status: projectStatus }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: '案件またはステータスを確認してください' }, { status: 400 });

  const { data, error } = await db
    .from('projects')
    .update({ status: parsed.data.status })
    .eq('id', parsed.data.id)
    .select('id,title,created_at,status,rate,match_results(total_score)')
    .single();
  if (error) return NextResponse.json({ error: 'ステータスを更新できませんでした' }, { status: 500 });
  return NextResponse.json(data);
}
