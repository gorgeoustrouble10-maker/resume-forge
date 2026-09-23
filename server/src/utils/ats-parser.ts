import { BaseOutputParser } from '@langchain/core/output_parsers';
import type { AtsSuggestion } from '../types/ats.types.js';
import { extractJsonObject } from './json.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pickString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function parseSuggestion(value: unknown): AtsSuggestion | null {
  if (!isRecord(value)) return null;
  const location = pickString(value.location);
  const issue = pickString(value.issue);
  const suggestion = pickString(value.suggestion);
  if (!location || !issue || !suggestion) return null;
  return { location, issue, suggestion };
}

/**
 * LangChain 输出解析器：ATS 客观指标由代码计算，
 * LLM 只输出按优先级排序的 suggestions。
 */
export class AtsJsonParser extends BaseOutputParser<AtsSuggestion[]> {
  lc_namespace = ['resume_forge', 'parsers'];

  async parse(text: string): Promise<AtsSuggestion[]> {
    let parsed: unknown;
    try {
      parsed = extractJsonObject(text);
    } catch {
      throw new Error('模型输出不是合法 JSON，无法解析 ATS 建议');
    }
    if (!isRecord(parsed) || !Array.isArray(parsed.suggestions)) {
      throw new Error('模型输出缺少 suggestions 数组');
    }
    return parsed.suggestions
      .map(parseSuggestion)
      .filter((item): item is AtsSuggestion => item !== null);
  }

  /** 注入 Prompt 的输出契约说明 */
  getFormatInstructions(): string {
    return [
      '只输出一个 JSON 对象，不要输出 JSON 以外的任何文字，不要使用代码块。结构如下：',
      '{',
      '  "suggestions": [',
      '    { "location": "位置（简历章节/字段名）", "issue": "问题（必须基于系统检测事实）", "suggestion": "具体可执行的修改建议" }',
      '  ]',
      '}',
      '',
      '注意：不要输出 keywordCoverage、formatCompatibility、infoCompleteness、passProbability 等任何分数字段，这些由系统计算。',
    ].join('\n');
  }
}
