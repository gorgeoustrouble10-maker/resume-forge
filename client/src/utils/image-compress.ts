/**
 * 浏览器本地头像压缩：用 Canvas API 把原始照片压成 JPEG dataURL，
 * 文件不离开用户设备，不经过后端。
 * 设计目标：长边 400px、JPEG 0.85 质量、最终 < 200KB。
 */

const MAX_DIMENSION = 400;
const TARGET_QUALITY = 0.85;
const FALLBACK_QUALITY = 0.6;
const MAX_BYTES = 200 * 1024;
const MAX_INPUT_BYTES = 10 * 1024 * 1024; // 10MB 上限，超过直接拒绝

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('读取压缩结果失败'));
      }
    };
    reader.onerror = () => reject(new Error('FileReader 错误'));
    reader.readAsDataURL(blob);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas.toBlob 失败'));
      },
      'image/jpeg',
      quality,
    );
  });
}

/**
 * 压缩头像文件为 JPEG dataURL。
 * @returns dataURL 字符串，可直接写入 PersonalInfo.avatar
 */
export async function compressAvatar(file: File): Promise<{ dataUrl: string; sizeBytes: number }> {
  if (!file.type.startsWith('image/')) {
    throw new Error('请上传图片文件');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error(`图片过大（${(file.size / 1024 / 1024).toFixed(1)}MB），请选择 < 10MB 的图片`);
  }

  // createImageBitmap 在主流浏览器都支持，比 Image + onload 更快且不污染 DOM
  const bitmap = await createImageBitmap(file);
  try {
    // 等比缩放：长边限 400，短边按比例
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, MAX_DIMENSION / longest);
    const targetW = Math.max(1, Math.round(bitmap.width * scale));
    const targetH = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D 上下文不可用');
    // 白色背景：JPEG 不支持透明，避免透明区域被渲染成黑色
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);

    // 首次压缩
    let blob = await canvasToBlob(canvas, TARGET_QUALITY);
    // 超过 200KB 降质量重压一次
    if (blob.size > MAX_BYTES) {
      blob = await canvasToBlob(canvas, FALLBACK_QUALITY);
    }

    const dataUrl = await blobToDataUrl(blob);
    return { dataUrl, sizeBytes: blob.size };
  } finally {
    // 释放 ImageBitmap 资源，避免内存泄漏
    bitmap.close();
  }
}

/** 把字节大小格式化为人类可读字符串 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
