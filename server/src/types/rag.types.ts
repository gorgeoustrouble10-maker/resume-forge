/**
 * RAG 知识库相关类型定义。
 * 知识库按 data/knowledge 下的一级目录分为三类，切块后带元数据入库。
 */

/** 知识库分类：简历模板 / HR 评分标准 / 岗位 JD 关键词 */
export type KnowledgeCategory = 'templates' | 'hr-standards' | 'job-descriptions';

export const KNOWLEDGE_CATEGORIES: readonly KnowledgeCategory[] = [
  'templates',
  'hr-standards',
  'job-descriptions',
] as const;

/** 从磁盘读取的原始 markdown 知识文件 */
export interface KnowledgeSourceFile {
  /** 相对于知识库根目录的路径，同时作为文档唯一来源标识 */
  relativePath: string;
  category: KnowledgeCategory;
  /** 取自一级标题，缺省时用文件名 */
  title: string;
  content: string;
}

/** 切块片段的完整元数据（随向量一起持久化） */
export interface ChunkMetadata {
  source: string;
  category: KnowledgeCategory;
  title: string;
  chunkIndex: number;
  chunkCount: number;
}

/** Chroma 风格的扁平元数据值类型（仅允许原始值） */
export type StoredMetadataValue = string | number | boolean;
export type StoredMetadata = Record<string, StoredMetadataValue>;

/** 向量库中的一条记录 */
export interface VectorRecord {
  id: string;
  embedding: number[];
  document: string;
  metadata: StoredMetadata;
}

export interface RetrieveOptions {
  /** 仅在指定分类内检索；不传则全库检索 */
  categories?: KnowledgeCategory[];
  /** 返回片段数量，缺省走 config.rag.topK */
  k?: number;
}

/** 业务层消费的检索结果 */
export interface RetrievedChunk {
  id: string;
  content: string;
  /** 余弦相似度，越接近 1 越相关 */
  score: number;
  metadata: ChunkMetadata;
}

/** 灌库结果统计 */
export interface IngestResult {
  mode: 'local' | 'remote';
  collection: string;
  files: number;
  chunks: number;
  byCategory: Record<KnowledgeCategory, number>;
}

/** 知识库状态（供健康检查 / 前端提示先灌库） */
export interface KnowledgeStatus {
  mode: 'local' | 'remote';
  collection: string;
  count: number;
  storagePath: string;
}
