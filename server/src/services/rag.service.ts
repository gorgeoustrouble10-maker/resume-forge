import { config } from '../config/index.js';
import { loadKnowledgeFiles } from '../utils/markdown-loader.js';
import { createKnowledgeSplitter, splitKnowledgeFile } from '../utils/text-splitter.js';
import { createVectorStore, type LocalVectorStore } from '../utils/vector-store.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import {
  KNOWLEDGE_CATEGORIES,
  type ChunkMetadata,
  type IngestResult,
  type KnowledgeCategory,
  type KnowledgeStatus,
  type RetrievedChunk,
  type RetrieveOptions,
  type VectorRecord,
} from '../types/rag.types.js';
import type { Embeddings } from '@langchain/core/embeddings';
import type { Document } from '@langchain/core/documents';

let storeInstance: LocalVectorStore | null = null;
let embeddingsInstance: Embeddings | null = null;

async function getStore(): Promise<LocalVectorStore> {
  if (storeInstance) return storeInstance;
  const { store, embeddings } = await createVectorStore(
    config.chroma.mode,
    config.chroma.dbPath,
    config.chroma.collectionName,
    config.chroma.remoteUrl,
  );
  if (!store) {
    throw new AppError(ErrorCode.CONFIG_ERROR, 500, '向量存储未初始化');
  }
  storeInstance = store;
  embeddingsInstance = embeddings;
  return store;
}

/** 将 Document 元数据转为可存储的扁平元数据 */
function toStoredMetadata(meta: ChunkMetadata): Record<string, string | number | boolean> {
  return {
    source: meta.source,
    category: meta.category,
    title: meta.title,
    chunkIndex: meta.chunkIndex,
    chunkCount: meta.chunkCount,
  };
}

/**
 * RAG 服务：灌库（离线） + 检索（在线）。
 * 灌库流程：读取 data/knowledge 下全部 markdown → LangChain 切块 → 向量化 → 文件持久化。
 * 检索流程：查询文本 → 向量化 → 余弦相似度 topK → 返回业务层消费的片段。
 */
export const ragService = {
  /** 全量灌库（幂等：清空后重写） */
  async ingest(): Promise<IngestResult> {
    const store = await getStore();
    const files = await loadKnowledgeFiles(config.knowledgeBasePath);
    if (files.length === 0) {
      throw new AppError(
        ErrorCode.KNOWLEDGE_EMPTY,
        409,
        `知识库为空，请在 ${config.knowledgeBasePath} 下放置 markdown 文件`,
      );
    }

    const splitter = createKnowledgeSplitter(config.rag.chunkSize, config.rag.chunkOverlap);
    const allChunks: Document<ChunkMetadata>[] = [];
    for (const file of files) {
      const chunks = await splitKnowledgeFile(file, splitter);
      allChunks.push(...chunks);
    }

    // 向量化所有片段
    if (!embeddingsInstance) {
      throw new AppError(ErrorCode.CONFIG_ERROR, 500, 'Embeddings 未初始化');
    }
    const texts = allChunks.map((chunk) => chunk.pageContent);
    const vectors = await embeddingsInstance.embedDocuments(texts);

    const records: VectorRecord[] = allChunks.map((chunk, index) => ({
      id: `chunk-${index.toString(36).padStart(6, '0')}`,
      embedding: vectors[index],
      document: chunk.pageContent,
      metadata: toStoredMetadata(chunk.metadata),
    }));

    await store.upsert(records);

    const byCategory = {} as Record<KnowledgeCategory, number>;
    for (const category of KNOWLEDGE_CATEGORIES) {
      byCategory[category] = records.filter(
        (record) => record.metadata.category === category,
      ).length;
    }

    return {
      mode: config.chroma.mode,
      collection: config.chroma.collectionName,
      files: files.length,
      chunks: records.length,
      byCategory,
    };
  },

  /** 相似度检索 */
  async retrieve(query: string, options: RetrieveOptions = {}): Promise<RetrievedChunk[]> {
    const store = await getStore();
    const count = await store.count();
    if (count === 0) {
      throw new AppError(
        ErrorCode.KNOWLEDGE_EMPTY,
        409,
        '知识库尚未灌库，请先运行 npm run ingest',
      );
    }
    return store.query(query, { k: options.k ?? config.rag.topK, categories: options.categories });
  },

  /** 知识库状态（健康检查用） */
  async status(): Promise<KnowledgeStatus> {
    const store = await getStore();
    return store.status();
  },
};
