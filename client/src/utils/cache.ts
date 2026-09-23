/**
 * 分析报告的本地缓存。
 * 设计目的：
 * - 留痕：评分/ATS 报告持久化在用户浏览器 localStorage，刷新不丢失；
 * - 稳定：同一份简历（内容 hash 相同）永远返回同一份报告，杜绝两次检测结果漂移；
 * - 省 token：命中缓存时不再请求 LLM。
 * 数据只存在用户本机，服务端不做任何用户数据持久化。
 */

export type AnalysisScope = 'scoring' | 'ats' | 'hallucination';

const CACHE_PREFIX = 'resume-forge:analysis:';
/** 缓存有效期 7 天；简历内容变化后 hash key 自动变化，不依赖过期失效 */
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** FNV-1a 32 位哈希（确定性字符串指纹），返回 8 位十六进制 */
export function fnv1aHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    // FNV prime 2^24 + 2^8 + 0x93
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** 计算分析请求的缓存键：岗位 + 简历正文 + 时间线事实，任一变化即 miss */
export function buildAnalysisKey(
  scope: AnalysisScope,
  targetPosition: string,
  resumeMarkdown: string,
  timelineJson?: string,
): string {
  const raw = `${scope}\u0000${targetPosition}\u0000${resumeMarkdown}\u0000${timelineJson ?? ''}`;
  return `${CACHE_PREFIX}${scope}:${fnv1aHash(raw)}`;
}

interface CacheEnvelope<T> {
  payload: T;
  cachedAt: string;
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** 读取缓存；不存在、过期或解析失败时返回 null */
export function getCachedAnalysis<T>(key: string): CacheEnvelope<T> | null {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const envelope = JSON.parse(raw) as CacheEnvelope<T>;
    const cachedAtMs = Date.parse(envelope.cachedAt);
    if (!Number.isFinite(cachedAtMs) || Date.now() - cachedAtMs > CACHE_TTL_MS) {
      storage.removeItem(key);
      return null;
    }
    return envelope;
  } catch {
    return null;
  }
}

/** 写入缓存（静默失败：隐私模式或配额超时时不影响主流程） */
export function setCachedAnalysis<T>(key: string, payload: T): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    const envelope: CacheEnvelope<T> = { payload, cachedAt: new Date().toISOString() };
    storage.setItem(key, JSON.stringify(envelope));
  } catch {
    // 配额满等场景：放弃缓存，不阻断分析流程
  }
}
