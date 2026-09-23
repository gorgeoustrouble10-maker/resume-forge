/** 浏览器本地 PDF 文本提取：文件不离开用户设备，不经过后端 */
export async function extractPdfText(file: File): Promise<string> {
  const [{ getDocument, GlobalWorkerOptions }, { default: workerUrl }] =
    await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]);
  GlobalWorkerOptions.workerSrc = workerUrl;

  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = getDocument({ data });
  const doc = await loadingTask.promise;

  try {
    const lines: string[] = [];
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      let line = '';
      for (const item of content.items) {
        if (!('str' in item)) continue;
        line += item.str;
        if (item.hasEOL) {
          lines.push(line.trim());
          line = '';
        }
      }
      if (line.trim()) lines.push(line.trim());
    }

    const text = lines.filter(Boolean).join('\n');
    if (!text.trim()) {
      throw new Error('未能从 PDF 提取到文字：可能是扫描版/图片版简历，暂不支持');
    }
    return text;
  } finally {
    await loadingTask.destroy();
  }
}
