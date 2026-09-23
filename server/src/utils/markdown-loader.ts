import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { AppError, ErrorCode } from './errors.js';
import {
  KNOWLEDGE_CATEGORIES,
  type KnowledgeCategory,
  type KnowledgeSourceFile,
} from '../types/rag.types.js';

function isKnowledgeCategory(value: string): value is KnowledgeCategory {
  return (KNOWLEDGE_CATEGORIES as readonly string[]).includes(value);
}

/** 取 markdown 的第一个一级标题作为文档标题 */
function extractTitle(content: string, fallback: string): string {
  const match = content.match(/^#\s+(.+)$/mu);
  return match ? match[1].trim() : fallback;
}

/** 递归收集目录下所有 .md 文件（返回相对路径） */
async function walkMarkdownFiles(dir: string, baseDir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkMarkdownFiles(absolute, baseDir)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      files.push(path.relative(baseDir, absolute));
    }
  }
  return files;
}

/**
 * 读取知识库根目录下的全部 markdown 文档。
 * 一级子目录名必须是合法分类（templates / hr-standards / job-descriptions）。
 */
export async function loadKnowledgeFiles(
  rootDir: string,
): Promise<KnowledgeSourceFile[]> {
  let relativeFiles: string[];
  try {
    relativeFiles = await walkMarkdownFiles(rootDir, rootDir);
  } catch (error) {
    throw new AppError(
      ErrorCode.KNOWLEDGE_EMPTY,
      409,
      `知识库目录不可读或不存在: ${rootDir}`,
      error instanceof Error ? error.message : undefined,
    );
  }

  const sources: KnowledgeSourceFile[] = [];
  for (const relativePath of relativeFiles.sort()) {
    const category = relativePath.split(path.sep)[0];
    if (!category || !isKnowledgeCategory(category)) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        500,
        `知识库文件 ${relativePath} 不在合法分类目录下（templates/hr-standards/job-descriptions）`,
      );
    }
    const absolute = path.join(rootDir, relativePath);
    const content = await readFile(absolute, 'utf-8');
    sources.push({
      relativePath: relativePath.split(path.sep).join('/'),
      category,
      title: extractTitle(content, path.basename(relativePath, '.md')),
      content,
    });
  }
  return sources;
}
