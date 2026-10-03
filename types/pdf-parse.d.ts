declare module 'pdf-parse' {
  interface PdfInfo {
    text: string;
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: unknown;
    version: string;
  }

  function parsePdf(data: Buffer, options?: Record<string, unknown>): Promise<PdfInfo>;
  export default parsePdf;
}
