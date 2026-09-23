import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { LocalHashingEmbeddings } from './local-embeddings.js';
import { AppError, ErrorCode } from './errors.js';
import type {
  ChunkMetadata,
  KnowledgeStatus,
  RetrievedChunk,
  RetrieveOptions,
  VectorRecord,
  IngestResult,
} from '../types/rag.types.js';
import type { Embeddings } from '@langchain/core/embeddings';

/** 存储记录的磁盘格式（含版本号，便于未来迁移） */
interface StoredCollection {
  version: 1;
  collection: string;
  records: VectorRecord[];
}

/** 余弦相似度（向量已 L2 归一化时点积即等于余弦） */
function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < len; i += 1) {
    dot += a[i] * b[i];
  }
  return dot;
}

/**
 * 本地嵌入式向量存储适配器。
 * 设计意图：Chroma 的 JS 客户端只支持 HTTP 服务端，嵌入式仅 Python 版可用，
 * 为遵守"不部署服务端、本地文件存储"约束，在此自实现一个文件持久化 +
 * 余弦相似度检索的最小适配器，保持与 chromadb IEmbeddingFunction 接口同构。
 * 切换到真实 Chroma 只需改 config.chroma.mode=remote，由 VectorStore 工厂分流。
 */
export class LocalVectorStore {
  private readonly dataFile: string;
  private records: VectorRecord[] = [];
  private loaded = false;

  constructor(
    private readonly collectionDir: string,
    private readonly collectionName: string,
    private readonly embeddings: Embeddings,
  ) {
    this.dataFile = path.join(collectionDir, 'collection.json');
  }

  /** 懒加载：首次访问时从磁盘读取 */
  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await readFile(this.dataFile, 'utf-8');
      const data = JSON.parse(raw) as StoredCollection;
      this.records = Array.isArray(data.records) ? data.records : [];
    } catch {
      // 文件不存在或解析失败视为空库
      this.records = [];
    }
    this.loaded = true;
  }

  /** 全量重写灌库（upsert 语义：清空后写入） */
  async upsert(records: VectorRecord[]): Promise<void> {
    await mkdir(this.collectionDir, { recursive: true });
    this.records = records;
    const payload: StoredCollection = {
      version: 1,
      collection: this.collectionName,
      records,
    };
    await writeFile(this.dataFile, JSON.stringify(payload, null, 2), 'utf-8');
    this.loaded = true;
  }

  async count(): Promise<number> {
    await this.ensureLoaded();
    return this.records.length;
  }

  /** 按相似度检索 topK，可按分类过滤 */
  async query(
    queryText: string,
    options: RetrieveOptions,
  ): Promise<RetrievedChunk[]> {
    await this.ensureLoaded();
    const k = options.k ?? 4;
    const categories = options.categories;

    const queryVector = await this.embeddings.embedQuery(queryText);
    const candidates = categories
      ? this.records.filter(
          (record) =>
            typeof record.metadata.category === 'string' &&
            categories.includes(record.metadata.category as ChunkMetadata['category']),
        )
      : this.records;

    return candidates
      .map((record) => ({
        id: record.id,
        content: record.document,
        score: cosineSimilarity(queryVector, record.embedding),
        metadata: this.restoreMetadata(record.metadata),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  async status(): Promise<KnowledgeStatus> {
    await this.ensureLoaded();
    return {
      mode: 'local',
      collection: this.collectionName,
      count: this.records.length,
      storagePath: this.dataFile,
    };
  }

  /** 清空集合（ingest 前重置） */
  async clear(): Promise<void> {
    this.records = [];
    this.loaded = true;
    try {
      await rm(this.dataFile, { force: true });
    } catch {
      // 忽略：文件不存在即视为已清空
    }
  }

  /** 把存储的扁平元数据还原回强类型（兼容 chromadb 的字符串值） */
  private restoreMetadata(stored: Record<string, unknown>): ChunkMetadata {
    const category = String(stored.category ?? '');
    return {
      source: String(stored.source ?? ''),
      category: category as ChunkMetadata['category'],
      title: String(stored.title ?? ''),
      chunkIndex: Number(stored.chunkIndex ?? 0),
      chunkCount: Number(stored.chunkCount ?? 0),
    };
  }
}

/** 工厂：按 config 创建存储实例；remote 模式抛出未实现错误（保持 service 层接口统一） */
export async function createVectorStore(
  mode: 'local' | 'remote',
  dbPath: string,
  collectionName: string,
  remoteUrl: string,
): Promise<{ store: LocalVectorStore | null; embeddings: Embeddings }> {
  const embeddings = new LocalHashingEmbeddings({});
  if (mode === 'local') {
    const store = new LocalVectorStore(dbPath, collectionName, embeddings);
    return { store, embeddings };
  }
  throw new AppError(
    ErrorCode.CONFIG_ERROR,
    500,
    `Chroma remote 模式尚未启用（需先部署 Chroma 服务端于 ${remoteUrl} 并实现远程适配器）`,
  );
}

export type { IngestResult };
