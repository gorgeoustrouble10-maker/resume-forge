import { BaseOutputParser } from '@langchain/core/output_parsers';
import type {
  ScoringDimension,
  ScoringSuggestion,
} from '../types/scoring.types.js';
import { extractJsonObject } from './json.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pickString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function parseSuggestion(value: unknown): ScoringSuggestion | null {
  if (!isRecord(value)) return null;
  const location = pickString(value.location);
  const issue = pickString(value.issue);
  const suggestion = pickString(value.suggestion);
  if (!location || !issue || !suggestion) return null;
  return { location, issue, suggestion };
}

/** LLM 对客观维度（量化率/关键词）只产出评语与建议，分数由代码填充 */
export interface ObjectiveDimensionLlm {
  comment: string;
  suggestions: ScoringSuggestion[];
}

/** LLM 对主观维度（岗位匹配/逻辑清晰度）产出分数、评语与建议 */
export interface SubjectiveDimensionLlm extends ObjectiveDimensionLlm {
  score: number;
}

/** LLM 评分输出草稿（不含 overall，总分由代码加权） */
export interface ScoringLlmDraft {
  position_match: SubjectiveDimensionLlm;
  experience_quantification: ObjectiveDimensionLlm;
  logical_clarity: SubjectiveDimensionLlm;
  keyword_match: ObjectiveDimensionLlm;
  summary: string;
}

function parseSuggestions(value: unknown): ScoringSuggestion[] {
  const raw = Array.isArray(value) ? value : [];
  return raw
    .map(parseSuggestion)
    .filter((item): item is ScoringSuggestion => item !== null);
}

function parseObjectiveBlock(value: unknown, dimension: ScoringDimension): ObjectiveDimensionLlm {
  if (!isRecord(value)) {
    throw new Error(`模型输出缺少维度块: ${dimension}`);
  }
  const comment = pickString(value.comment);
  if (!comment) {
    throw new Error(`模型输出的维度 ${dimension} 缺少 comment`);
  }
  return { comment, suggestions: parseSuggestions(value.suggestions) };
}

function parseSubjectiveBlock(
  value: unknown,
  dimension: ScoringDimension,
): SubjectiveDimensionLlm {
  const base = parseObjectiveBlock(value, dimension);
  if (!isRecord(value) || typeof value.score !== 'number' || !Number.isFinite(value.score)) {
    throw new Error(`模型输出的主观维度 ${dimension} 缺少数值 score`);
  }
  const score = Math.round(value.score);
  if (score < 0 || score > 100) {
    throw new Error(`模型输出的维度 ${dimension} 分数超出 0-100`);
  }
  return { ...base, score };
}

/**
 * LangChain 输出解析器：把模型文本解析为 ScoringLlmDraft。
 * 客观维度分数由 scoring.service 用规则引擎结果填充，overall 由代码加权计算。
 */
export class ScoringJsonParser extends BaseOutputParser<ScoringLlmDraft> {
  lc_namespace = ['resume_forge', 'parsers'];

  async parse(text: string): Promise<ScoringLlmDraft> {
    let parsed: unknown;
    try {
      parsed = extractJsonObject(text);
    } catch {
      throw new Error('模型输出不是合法 JSON，无法解析评分结果');
    }
    if (!isRecord(parsed)) {
      throw new Error('模型输出的 JSON 顶层结构不是对象');
    }

    const summary = pickString(parsed.summary);
    if (!summary) {
      throw new Error('模型输出缺少 summary 字段');
    }

    return {
      position_match: parseSubjectiveBlock(parsed.position_match, 'position_match'),
      experience_quantification: parseObjectiveBlock(
        parsed.experience_quantification,
        'experience_quantification',
      ),
      logical_clarity: parseSubjectiveBlock(parsed.logical_clarity, 'logical_clarity'),
      keyword_match: parseObjectiveBlock(parsed.keyword_match, 'keyword_match'),
      summary,
    };
  }

  /** 注入 Prompt 的输出契约说明 */
  getFormatInstructions(): string {
    return [
      '只输出一个 JSON 对象，不要输出 JSON 以外的任何文字，不要使用代码块。结构如下：',
      '{',
      '  "position_match": {',
      '    "score": 你打的0到100整数,',
      '    "comment": "评分理由（HR 视角的解释）",',
      '    "suggestions": [',
      '      { "location": "位置标识", "issue": "问题", "suggestion": "具体修改建议" }',
      '    ]',
      '  },',
      '  "logical_clarity": { "score": 你打的0到100整数, "comment": "...", "suggestions": [...] },',
      '  "experience_quantification": {',
      '    "comment": "必须引用系统量化统计数字撰写评语，不要输出 score 字段",',
      '    "suggestions": [...]',
      '  },',
      '  "keyword_match": {',
      '    "comment": "必须引用系统关键词覆盖率与命中/缺失列表撰写评语，不要输出 score 字段",',
      '    "suggestions": [...]',
      '  },',
      '  "summary": "总体评价一段话（与各维度结论一致）"',
      '}',
      '',
      '注意：不要输出 overall 字段；experience_quantification 与 keyword_match 不要输出 score；',
      '不要输出任何时间线/日期矛盾类内容。',
    ].join('\n');
  }
}
