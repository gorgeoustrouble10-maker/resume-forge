import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load environment variables from .env (only in non-production; safe no-op if file missing)
dotenv.config();

// Resolve server root directory regardless of CWD (ESM __dirname equivalent)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, '..', '..');

// Chroma 运行模式：local=纯 Node 嵌入式文件存储（默认，无需额外进程）；
// remote=连接外部 Chroma HTTP 服务端（真实 Chroma HNSW，需自行部署）
const chromaMode = process.env.CHROMA_MODE === 'remote' ? 'remote' : 'local';

/**
 * Centralized application configuration.
 * All env-driven values flow through here so service layers stay decoupled.
 */
export const config = {
  port: Number(process.env.PORT) || 3001,
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    modelName: process.env.DEEPSEEK_MODEL || 'deepseek-coder',
    // 可选：DeepSeek 兼容端点覆盖（默认走 https://api.deepseek.com）
    baseUrl: process.env.DEEPSEEK_BASE_URL || '',
  },
  chroma: {
    mode: chromaMode as 'local' | 'remote',
    dbPath: path.resolve(serverRoot, process.env.CHROMA_DB_PATH || './data/chroma'),
    collectionName: process.env.CHROMA_COLLECTION || 'resume-knowledge',
    // remote 模式下的 Chroma 服务端地址
    remoteUrl: process.env.CHROMA_REMOTE_URL || 'http://localhost:8000',
  },
  knowledgeBasePath: path.resolve(
    serverRoot,
    process.env.KNOWLEDGE_BASE_PATH || './data/knowledge',
  ),
  rag: {
    // markdown 语义切块参数（字符级）
    chunkSize: Number(process.env.RAG_CHUNK_SIZE) || 600,
    chunkOverlap: Number(process.env.RAG_CHUNK_OVERLAP) || 100,
    // 每路检索返回的相关片段数
    topK: Number(process.env.RAG_TOP_K) || 4,
  },
} as const;

export type AppConfig = typeof config;
