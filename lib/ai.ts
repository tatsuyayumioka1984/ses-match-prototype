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
const sheetSchema=z.object({skills:z.array(z.object({name:z.string(),years:z.number().nullable(),level:z.string().nullable()})),experience:z.array(z.object({period:z.string().nullable(),industry:z.string().nullable(),description:z.string(),role:z.string().nullable(),technologies:z.array(z.string())})),strengths:z.array(z.string()).max(5)});
const sheetChunkSchema=z.object({skills:z.array(z.object({name:z.string(),years:z.number().nullable(),level:z.string().nullable()})),experience:z.array(z.object({period:z.string().nullable(),industry:z.string().nullable(),description:z.string(),role:z.string().nullable(),technologies:z.array(z.string())})),strengths:z.array(z.string())});
function anthropicSchema(schema:z.ZodTypeAny):Record<string,unknown>{
 const jsonSchema=z.toJSONSchema(schema) as Record<string,unknown>;
 const clean=(value:any):any=>{
  if(Array.isArray(value))return value.map(clean);
  if(!value||typeof value!=='object')return value;
  const out:Record<string,unknown>={};
  for(const [key,item] of Object.entries(value)){
   if(key==='$schema'||key==='minimum'||key==='maximum')continue;
   out[key]=clean(item);
  }
  return out;
 };
 return clean(jsonSchema);
}
async function json<T>(prompt:string,schema:z.ZodType<T>):Promise<T>{
 const res=await client.messages.create({model:process.env.ANTHROPIC_MODEL!,max_tokens:2400,temperature:0,messages:[{role:'user',content:prompt}],output_config:{format:{type:'json_schema',schema:anthropicSchema(schema)}}} as any);
 const raw=res.content.find(x=>x.type==='text')?.text??'';
 try{return schema.parse(JSON.parse(raw))}catch(error){
  if(error instanceof z.ZodError){const issue=error.issues[0];const path=issue?.path.join('.')||'(root)';throw new Error(`AIの応答形式が一致しません（${path}: ${issue?.message??'不明な形式'}）。ファイル内容を確認して再度お試しください。`)}
  throw new Error('AIの応答をJSONとして読み取れませんでした。ファイル内容を確認して再度お試しください。');
 }
}
export async function analyzeMatch(input:{sheet:unknown;profile:unknown;project:unknown}){const match=await json(`スキルシート・プロフィール・案件に基づきマッチ度を評価します。記載のないスキルをあるものとして扱わず、根拠を引用し日本語で記述してください。条件面は希望と案件を比較。\n${JSON.stringify(input)}`,matchSchema);const weights=(input.profile as any)?.weights??{tech:20,experience:50,career:30};const total=Math.round(match.tech.score*weights.tech/100+match.experience.score*weights.experience/100+match.career.score*weights.career/100);return { ...match,total_score:total };}
export const extractProject=(text:string)=>json(`案件情報から抽出。読めない値はnull、要件は必須/歓迎に分け、推測しない。\n${text}`,projectSchema);
function splitSheetText(text:string,maxChars=30000){
 const chunks:string[]=[];let start=0;
 while(start<text.length){let end=Math.min(start+maxChars,text.length);if(end<text.length){const boundary=text.lastIndexOf('\n',end);if(boundary>start+maxChars*.65)end=boundary;}chunks.push(text.slice(start,end));if(end===text.length)break;start=Math.max(start+1,end-400);}
 return chunks;
}
export async function extractSheet(text:string){
 if(text.length>1_000_000)throw new Error('スキルシートが長すぎます（1ファイル100万文字まで）。');
 if(text.length<=30_000)return json(`スキルシートから構造化。固定セル位置に依存しない。実績のない数字や強みを創作しない。\n${text}`,sheetSchema);
 const chunks=splitSheetText(text);const results=[] as z.infer<typeof sheetChunkSchema>[];
 for(let i=0;i<chunks.length;i++)results.push(await json(`これは全${chunks.length}分割のスキルシートの${i+1}番目です。記載された内容だけを抽出し、実績・技術・強みを創作しないでください。該当情報がない配列は空にしてください。\n${chunks[i]}`,sheetChunkSchema));
 const skills=new Map<string,{name:string;years:number|null;level:string|null}>();const experience=new Map<string,{period:string|null;industry:string|null;description:string;role:string|null;technologies:string[]}>();const strengths=new Map<string,string>();
 for(const result of results){for(const item of result.skills){const key=item.name.trim().toLocaleLowerCase();if(!key)continue;const prior=skills.get(key);skills.set(key,prior?{...prior,years:Math.max(prior.years??0,item.years??0)||null,level:prior.level||item.level}:item);}for(const item of result.experience){const key=`${item.period||''}|${item.description.trim()}`.toLocaleLowerCase();if(key!=='|')experience.set(key,item);}for(const item of result.strengths){const value=item.trim();if(value)strengths.set(value.toLocaleLowerCase(),value);}}
 const merged={skills:[...skills.values()].slice(0,200),experience:[...experience.values()].slice(0,100),strengths:[...strengths.values()].slice(0,5)};
 return sheetSchema.parse(merged);
}
