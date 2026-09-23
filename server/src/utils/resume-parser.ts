import { BaseOutputParser } from '@langchain/core/output_parsers';
import type {
  ExperienceKind,
  ProfessionalExperience,
  ResumeDraft,
} from '../types/resume.types.js';
import { extractJsonObject } from './json.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pickString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function pickStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
}

/** 将未知 JSON 结构收窄为单条经历，字段非法时返回 null */
function parseExperience(value: unknown): ProfessionalExperience | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = pickString(value.id);
  const title = pickString(value.title);
  if (!id || !title) {
    return null;
  }
  const kind: ExperienceKind =
    value.kind === 'club' ? 'club' : value.kind === 'internship' ? 'internship' : 'project';
  const bullets = pickStringArray(value.bullets);
  if (bullets.length === 0) {
    return null;
  }
  return {
    id,
    kind,
    title,
    organization: pickString(value.organization),
    role: pickString(value.role),
    period: pickString(value.period),
    bullets,
  };
}

/**
 * LangChain 输出解析器：把模型文本解析并收窄为类型安全的 ResumeDraft。
 * 解析失败抛出的 Error 由 resume.service 统一包装为 AI_UPSTREAM_ERROR。
 */
export class ResumeJsonParser extends BaseOutputParser<ResumeDraft> {
  lc_namespace = ['resume_forge', 'parsers'];

  async parse(text: string): Promise<ResumeDraft> {
    let parsed: unknown;
    try {
      parsed = extractJsonObject(text);
    } catch {
      throw new Error('模型输出不是合法 JSON，无法解析简历草稿');
    }
    if (!isRecord(parsed)) {
      throw new Error('模型输出的 JSON 顶层结构不是对象');
    }

    const summary = pickString(parsed.summary);
    if (!summary) {
      throw new Error('模型输出缺少 summary 字段');
    }

    const rawExperiences = Array.isArray(parsed.experiences) ? parsed.experiences : [];
    const experiences = rawExperiences
      .map(parseExperience)
      .filter((item): item is ProfessionalExperience => item !== null);
    if (experiences.length === 0) {
      throw new Error('模型输出缺少有效的 experiences 列表');
    }

    const skills = pickStringArray(parsed.skills);

    return { summary, experiences, skills };
  }

  /** 注入 Prompt 的输出契约说明 */
  getFormatInstructions(): string {
    return [
      '只输出一个 JSON 对象，不要输出 JSON 以外的任何文字，不要使用代码块。结构如下：',
      '{',
      '  "summary": "字符串，3-4 句个人优势概述",',
      '  "experiences": [',
      '    {',
      '      "id": "与输入对应的 id（i1 实习 / p1 项目 / c1 社团）",',
      '      "kind": "internship、project 或 club",',
      '      "title": "经历标题",',
      '      "organization": "所属组织，可选",',
      '      "role": "担任角色，可选",',
      '      "period": "时间段，可选",',
      '      "bullets": ["STAR 化、动词开头、尽量量化的要点1", "要点2"]',
      '    }',
      '  ],',
      '  "skills": ["按与目标岗位相关性排序的技能"]',
      '}',
    ].join('\n');
  }
}
