import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import pdf from 'pdf-parse';
import { extractSheet } from '@/lib/ai';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET() {
  const db = await supabase();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });

  const { data, error } = await db
    .from('skill_sheets')
    .select('id,file_path,extracted,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'スキルシートを取得できませんでした' }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const db = await supabase();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'ログインしてください' }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY || !process.env.ANTHROPIC_MODEL) {
    return NextResponse.json({ error: 'Claude API設定がありません' }, { status: 503 });
  }

  let storagePath: string | null = null;
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'ファイルを選択してください' }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'ファイルは10MB以下にしてください' }, { status: 413 });

    const name = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    let text = '';
    let contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    let extension = 'xlsx';
    if (file.type === 'application/pdf' || name.endsWith('.pdf')) {
      text = (await pdf(buffer)).text;
      contentType = 'application/pdf';
      extension = 'pdf';
    } else if (name.endsWith('.xlsx')) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      text = workbook.worksheets
        .map((sheet) => sheet.getSheetValues().map((row) => Array.isArray(row) ? row.filter(Boolean).join(' | ') : '').join('\n'))
        .join('\n');
    } else {
      return NextResponse.json({ error: 'PDFまたはXLSXを選択してください' }, { status: 415 });
    }
    if (!text.trim()) return NextResponse.json({ error: 'ファイルから文字を読み取れませんでした。文字を選択できるPDFまたはXLSXをお試しください' }, { status: 422 });
    if (text.length > 1_000_000) return NextResponse.json({ error: 'スキルシートが長すぎます（1ファイル100万文字まで）' }, { status: 413 });

    const extracted = await extractSheet(text);
    storagePath = `${user.id}/skill-sheets/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await db.storage
      .from('private-documents')
      .upload(storagePath, buffer, { contentType, upsert: false });
    if (uploadError) throw new Error(`ストレージへの保存に失敗しました: ${uploadError.message}`);

    const { data, error: insertError } = await db
      .from('skill_sheets')
      .insert({ user_id: user.id, file_path: storagePath, extracted: { ...extracted, file_name: file.name } })
      .select('id,file_path,extracted,created_at')
      .single();
    if (insertError) {
      await db.storage.from('private-documents').remove([storagePath]);
      storagePath = null;
      throw new Error(`スキルシート情報の保存に失敗しました: ${insertError.message}`);
    }
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    if (storagePath) await db.storage.from('private-documents').remove([storagePath]);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'スキルシートの保存に失敗しました' }, { status: 500 });
  }
}
