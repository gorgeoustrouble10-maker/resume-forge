import { Embeddings, type EmbeddingsParams } from '@langchain/core/embeddings';

/**
 * 本地确定性向量化器（feature-hashing）。
 *
 * 设计背景：DeepSeek 官方仅提供对话模型、没有 Embedding 接口，
 * 且项目约束「唯一模型 DeepSeek Coder、不引入额外依赖」，
 * 因此 RAG 的向量化在此采用零网络、零模型下载的本地哈希向量：
 * - 英文/数字：按词切分（保留 c++、c#、node.js 等技术词形态）
 * - 中文：单字 + 相邻字二元组（bigram，是无分词器时中文词汇匹配的常用手段）
 * - 用 FNV-1a 哈希把 token 映射到固定维度，带符号哈希降低碰撞偏差，最后 L2 归一化
 * 归一化后点积即余弦相似度。它是「词法级语义」匹配，
 * 后续若开放模型选择，可在不改 service 层的情况下替换为真实 Embeddings。
 */
export const LOCAL_EMBEDDING_DIMENSIONS = 512;

/** FNV-1a 32 位哈希，返回无符号 32 位整数 */
function fnv1aHash(token: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    // Math.imul 保证 32 位有符号乘法语义
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** 抽取英文/数字词（含技术符号组合），如 react、c++、node.js、tcp/ip */
const LATIN_WORD_PATTERN = /[a-z0-9][a-z0-9+#./-]{0,}/g;

function tokenize(text: string): string[] {
  const lower = text.toLowerCase();
  const tokens: string[] = [];

  for (const match of lower.matchAll(LATIN_WORD_PATTERN)) {
    const word = match[0].replace(/[/.-]+$/u, '');
    if (word.length >= 2) {
      tokens.push(word);
    }
  }

  // 中文单字 + bigram
  const cjkChars: string[] = [];
  for (const ch of lower) {
    if (ch >= '一' && ch <= '鿿') {
      cjkChars.push(ch);
      tokens.push(ch);
    }
  }
  for (let i = 0; i < cjkChars.length - 1; i += 1) {
    tokens.push(cjkChars[i] + cjkChars[i + 1]);
  }

  return tokens;
}

function l2Normalize(vector: number[]): number[] {
  let norm = 0;
  for (const value of vector) {
    norm += value * value;
  }
  norm = Math.sqrt(norm);
  if (norm === 0) {
    return vector;
  }
  return vector.map((value) => value / norm);
}

export class LocalHashingEmbeddings extends Embeddings {
  constructor(params?: EmbeddingsParams) {
    super(params ?? {});
  }

  /** LangChain Embeddings 抽象：批量文档向量化 */
  async embedDocuments(documents: string[]): Promise<number[][]> {
    return documents.map((document) => this.embedOne(document));
  }

  /** LangChain Embeddings 抽象：单条查询向量化 */
  async embedQuery(document: string): Promise<number[]> {
    return this.embedOne(document);
  }

  /**
   * chromadb IEmbeddingFunction 的同构接口（generate），
   * 使本类可直接作为 chromadb 远端集合的 embeddingFunction（结构化类型兼容）。
   */
  async generate(texts: string[]): Promise<number[][]> {
    return this.embedDocuments(texts);
  }

  private embedOne(text: string): number[] {
    const vector = new Array<number>(LOCAL_EMBEDDING_DIMENSIONS).fill(0);
    for (const token of tokenize(text)) {
      const hash = fnv1aHash(token);
      const bucket = hash % LOCAL_EMBEDDING_DIMENSIONS;
      // 带符号哈希：用高位决定加减，缓解同桶碰撞造成的系统偏差
      const sign = (hash & 0x80000000) === 0 ? 1 : -1;
      vector[bucket] += sign;
    }
    return l2Normalize(vector);
  }
}
