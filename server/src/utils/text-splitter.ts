import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import type { ChunkMetadata, KnowledgeSourceFile } from '../types/rag.types.js';

/** 切块阶段的元数据（序号在切完后回填） */
type ChunkBaseMetadata = Omit<ChunkMetadata, 'chunkIndex' | 'chunkCount'>;

/**
 * 构建 markdown 语义切块器。
 * 分隔符优先按标题层级切，再退到段落 / 句子（含中文句读），
 * 尽量保持每个片段语义完整，overlap 缓解语义被截断。
 */
export function createKnowledgeSplitter(
  chunkSize: number,
  chunkOverlap: number,
): RecursiveCharacterTextSplitter {
  return new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
    separators: [
      '\n## ',
      '\n### ',
      '\n#### ',
      '\n\n',
      '\n',
      '。',
      '！',
      '？',
      '. ',
      ' ',
      '',
    ],
  });
}

/**
 * 将单个 markdown 知识文件切成带完整元数据的文档片段。
 */
export async function splitKnowledgeFile(
  file: KnowledgeSourceFile,
  splitter: RecursiveCharacterTextSplitter,
): Promise<Document<ChunkMetadata>[]> {
  const baseMetadata: ChunkBaseMetadata = {
    source: file.relativePath,
    category: file.category,
    title: file.title,
  };

  const sourceDoc = new Document<ChunkBaseMetadata>({
    pageContent: file.content,
    metadata: baseMetadata,
  });

  const chunks = await splitter.splitDocuments([sourceDoc]);

  return chunks
    .map((chunk) => chunk.pageContent.trim())
    .filter((content) => content.length > 0)
    .map((content, index, array) =>
      new Document<ChunkMetadata>({
        pageContent: content,
        metadata: {
          ...baseMetadata,
          chunkIndex: index,
          chunkCount: array.length,
        },
      }),
    );
}
