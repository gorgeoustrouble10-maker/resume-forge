import type { GeneratedResume } from '../types/resume';

/** 把字符串清成安全文件名片段：去掉 Windows/Linux 非法字符，空白转 _ */
function sanitizeFileName(input: string): string {
  return input
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .trim();
}

/** 拼装简历导出文件名：简历_张三_后端开发工程师.md */
function buildFileName(resume: GeneratedResume): string {
  const name = sanitizeFileName(resume.personalInfo.name) || 'resume';
  const position = sanitizeFileName(resume.targetPosition) || 'resume';
  return `简历_${name}_${position}.md`;
}

/**
 * 把简历 markdown 文本作为 .md 文件下载。
 * 用 Blob + URL.createObjectURL，零依赖、纯浏览器 API。
 */
export function downloadResumeMarkdown(resume: GeneratedResume): void {
  const blob = new Blob([resume.markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = buildFileName(resume);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 释放 blob URL，避免内存泄漏
  URL.revokeObjectURL(url);
}
