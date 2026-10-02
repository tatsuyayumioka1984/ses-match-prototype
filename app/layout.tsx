import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'SES Match | 案件マッチ度分析', description: 'SES案件とスキルシートの適合度を根拠とともに分析' };
export default function Layout({children}:{children:React.ReactNode}) { return <html lang="ja"><body>{children}</body></html>; }
