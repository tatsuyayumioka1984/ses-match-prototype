import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const matchSchema = z.object({
 tech:z.object({score:z.number().int().min(0).max(100),reason:z.string()}),
 experience:z.object({score:z.number().int().min(0).max(100),reason:z.string()}),
 career:z.object({score:z.number().int().min(0).max(100),reason:z.string()}),
 conditions:z.object({rate:z.object({status:z.enum(['ok','below','unknown']),comment:z.string()}),location:z.object({status:z.enum(['ok','check','unknown']),comment:z.string()})}),
 missing_skills:z.array(z.object({skill:z.string(),level:z.enum(['missing','unclear'])})), appeal_points:z.array(z.string())
});
export type Match = z.infer<typeof matchSchema>;
const projectSchema=z.object({title:z.string().nullable(),requirements:z.object({required:z.array(z.string()),preferred:z.array(z.string())}),description:z.string().nullable(),industry:z.string().nullable(),rate:z.number().int().nullable(),location:z.string().nullable(),work_style:z.string().nullable(),sales_contact:z.string().nullable()});
const sheetSchema=z.object({skills:z.array(z.object({name:z.string(),years:z.number().nullable(),level:z.string().nullable()})),experience:z.array(z.object({period:z.string().nullable(),industry:z.string().nullable(),description:z.string(),role:z.string().nullable(),technologies:z.array(z.string())})),strengths:z.array(z.string()).min(3).max(5)});
async function json<T>(prompt:string,schema:z.ZodType<T>):Promise<T>{
 let last=''; for(let attempt=0;attempt<2;attempt++){
  const res=await client.messages.create({model:process.env.ANTHROPIC_MODEL!,max_tokens:2400,temperature:0,messages:[{role:'user',content:`${prompt}\n\nJSONオブジェクトのみを返してください。説明やコードフェンスは不要です。${attempt?`\n前回の不正な応答: ${last.slice(0,1200)}\n同じ内容をスキーマに沿って修正してください。`:''}`} ]});
  const raw=res.content.find(x=>x.type==='text')?.text??'';last=raw;
  try{return schema.parse(JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g,'')))}catch{}
 } throw new Error('AIの応答を検証できませんでした。入力を確認して再度お試しください。');
}
export async function analyzeMatch(input:{sheet:unknown;profile:unknown;project:unknown}){const match=await json(`スキルシート・プロフィール・案件に基づきマッチ度を評価します。記載のないスキルをあるものとして扱わず、根拠を引用し日本語で記述してください。条件面は希望と案件を比較。\n${JSON.stringify(input)}`,matchSchema);const weights=(input.profile as any)?.weights??{tech:20,experience:50,career:30};const total=Math.round(match.tech.score*weights.tech/100+match.experience.score*weights.experience/100+match.career.score*weights.career/100);return { ...match,total_score:total };}
export const extractProject=(text:string)=>json(`案件情報から抽出。読めない値はnull、要件は必須/歓迎に分け、推測しない。\n${text}`,projectSchema);
export const extractSheet=(text:string)=>json(`スキルシートから構造化。固定セル位置に依存しない。実績のない数字や強みを創作しない。\n${text}`,sheetSchema);
