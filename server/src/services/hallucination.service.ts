import { normalizeKeyword } from '../utils/rule-engine.js';
import { validateTimeline } from '../utils/timeline.js';
import type {
  HallucinationIssue,
  HallucinationIssueType,
  HallucinationReport,
  Severity,
} from '../types/hallucination.types.js';
import type { ResumeDraft, ResumeInput } from '../types/resume.types.js';

/**
 * 内容幻觉校验服务。
 * 全程纯函数，不调 LLM：把"事实判断"从模型手里收回，避免 LLM 编造公司/学校/技能。
 * 生成场景：originalInput + draft 双输入，跑全部 4 类校验。
 * 上传场景：仅 resumeMarkdown，降级只跑 unsupported_metric。
 */

// ---------------------------------------------------------------------------
// 配置
// ---------------------------------------------------------------------------

/** 严重度扣分权重（起点 100） */
const SEVERITY_DEDUCTION: Record<Severity, number> = {
  high: 15,
  medium: 8,
  low: 3,
};

/**
 * 技能同义词映射：归一化后的标准名 -> 归一化后的别名集合。
 * 归一化函数（rule-engine.normalizeKeyword）会去掉 . _ - / 与空白并小写化，
 * 因此映射 key 已是归一化形态（如 'springboot'、'nodejs'）。
 */
const SKILL_SYNONYMS: Record<string, string[]> = {
  javascript: ['js', 'ecmascript'],
  typescript: ['ts'],
  nodejs: ['node'],
  react: ['reactjs'],
  vue: ['vuejs'],
  springboot: ['spring'],
  postgresql: ['postgres', 'pg'],
  mysqldb: ['mysql'],
  redis: [],
  docker: [],
  kubernetes: ['k8s'],
  ci_cd: ['cicd'],
  go: ['golang'],
};

/** 量化数字正则：百分比 / 金额 / 数量 / 倍数 / 比率 */
const METRIC_PATTERN = /\d+(?:\.\d+)?\s*(?:%|万|千|亿|个|次|项|倍|[xX]|\/)/g;

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

/** 判断 normalized 候选是否是 normalized 目标的同义词 */
function isSynonymOf(normalized: string, target: string): boolean {
  if (normalized === target) return true;
  for (const [canonical, aliases] of Object.entries(SKILL_SYNONYMS)) {
    const isTargetMatch = canonical === target || aliases.includes(target);
    if (!isTargetMatch) continue;
    if (canonical === normalized || aliases.includes(normalized)) return true;
  }
  return false;
}

/** 限定长度的 Levenshtein 编辑距离（双方长度差 > 3 直接放弃，避免 O(n*m) 卡顿） */
function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 3) return 999;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j];
  }
  return prev[b.length];
}

// ---------------------------------------------------------------------------
// 子校验
// ---------------------------------------------------------------------------

/** 主体名词溯源：draft.experiences 里的组织/项目/角色必须能在 input 中找到对应 */
function checkEntities(draft: ResumeDraft, input: ResumeInput): HallucinationIssue[] {
  const issues: HallucinationIssue[] = [];
  const whitelist = new Set<string>();

  // 从输入抽取白名单：学校 / 公司 / 项目 / 社团 / 角色 / 姓名
  for (const edu of input.education) {
    if (edu.school) whitelist.add(normalizeKeyword(edu.school));
  }
  for (const act of [...input.internships, ...input.projects, ...input.clubActivities]) {
    if (act.title) whitelist.add(normalizeKeyword(act.title));
    if (act.organization) whitelist.add(normalizeKeyword(act.organization));
    if (act.role) whitelist.add(normalizeKeyword(act.role));
  }
  if (input.personalInfo.name) whitelist.add(normalizeKeyword(input.personalInfo.name));
  if (input.targetPosition) whitelist.add(normalizeKeyword(input.targetPosition));

  draft.experiences.forEach((exp, idx) => {
    const fields: Array<{ name: string; value: string | undefined }> = [
      { name: 'organization', value: exp.organization },
      { name: 'title', value: exp.title },
      { name: 'role', value: exp.role },
    ];
    for (const { name, value } of fields) {
      if (!value || !value.trim()) continue;
      const normalized = normalizeKeyword(value);
      if (normalized.length < 2) continue;
      const matched = [...whitelist].some((wl) => {
        if (wl === normalized) return true;
        // 包含关系（一方是另一方子串）
        if (wl.length >= 2 && (wl.includes(normalized) || normalized.includes(wl))) return true;
        // 编辑距离 ≤ 2，且双方长度 ≥ 3（避免单字误判）
        if (wl.length >= 3 && normalized.length >= 3 && editDistance(wl, normalized) <= 2) return true;
        return false;
      });
      if (!matched) {
        issues.push({
          type: 'fabricated_entity',
          severity: 'high',
          location: `experiences[${idx}].${name}`,
          evidence: value,
          explanation: `「${value}」未在用户原始输入的学校/公司/项目/社团/角色中找到对应来源`,
        });
      }
    }
  });

  return issues;
}

/** 技能集溯源：draft.skills 必须是 input.skills 的子集或同义词 */
function checkSkills(draft: ResumeDraft, input: ResumeInput): HallucinationIssue[] {
  const issues: HallucinationIssue[] = [];
  const userSkills = input.skills.map((s) => normalizeKeyword(s));

  draft.skills.forEach((skill, idx) => {
    if (!skill.trim()) return;
    const normalized = normalizeKeyword(skill);
    if (normalized.length < 2) return;
    const matched = userSkills.some((us) => {
      if (us === normalized) return true;
      if (isSynonymOf(normalized, us)) return true;
      // 子串包含（避免技能名变体如 "React.js" ↔ "React"）
      if (us.length >= 3 && (us.includes(normalized) || normalized.includes(us))) return true;
      return false;
    });
    if (!matched) {
      issues.push({
        type: 'fabricated_skill',
        severity: 'medium',
        location: `skills[${idx}]`,
        evidence: skill,
        explanation: `「${skill}」未出现在用户填写的技能清单中，也不在常见同义词映射里`,
      });
    }
  });

  return issues;
}

/** 量化数字标记：扫描所有 bullet 文本，标记无法溯源的量化数据 */
function checkMetrics(draft: ResumeDraft | undefined, resumeMarkdown: string | undefined): HallucinationIssue[] {
  const issues: HallucinationIssue[] = [];
  const scan = (text: string, location: string) => {
    METRIC_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = METRIC_PATTERN.exec(text)) !== null) {
      issues.push({
        type: 'unsupported_metric',
        severity: 'low',
        location,
        evidence: match[0],
        explanation: `检测到量化数据「${match[0]}」，系统无法验证用户是否真有此数据，建议用户核对`,
      });
    }
  };

  if (draft && draft.experiences.length > 0) {
    draft.experiences.forEach((exp, ei) => {
      exp.bullets.forEach((bullet, bi) => {
        scan(bullet, `experiences[${ei}].bullets[${bi}]`);
      });
    });
  } else if (resumeMarkdown) {
    // 上传场景：扫描 markdown 中所有列表行（- 或 • 开头）
    const lines = resumeMarkdown.split('\n');
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (/^[-*•·]/.test(trimmed) || /^\d+[.、)）]/.test(trimmed)) {
        scan(line, `markdown.line[${idx + 1}]`);
      }
    });
  }

  return issues;
}

/** 时间线复用：调 validateTimeline，冲突项转 hallucination 问题 */
function checkTimeline(input: ResumeInput | undefined): HallucinationIssue[] {
  if (!input) return [];
  const report = validateTimeline({
    education: input.education,
    internships: input.internships,
    projects: input.projects,
    clubActivities: input.clubActivities,
  });
  return report.issues.map((issue) => ({
    type: 'timeline_mismatch' as HallucinationIssueType,
    severity: 'high' as Severity,
    location: issue.location,
    evidence: issue.message,
    explanation: '时间线冲突：日期先后关系由代码基于 YYYY-MM 精确比较得出',
  }));
}

// ---------------------------------------------------------------------------
// 公开 API
// ---------------------------------------------------------------------------

export interface HallucinationVerifyParams {
  /** LLM 输出的结构化简历（生成场景必传） */
  draft?: ResumeDraft;
  /** 用户原始表单（生成场景必传；缺失则跳过主体/技能/时间线校验） */
  originalInput?: ResumeInput;
  /** 简历 markdown 全文（上传场景必传；生成场景可不传） */
  resumeMarkdown?: string;
}

export const hallucinationService = {
  verify(params: HallucinationVerifyParams): HallucinationReport {
    const issues: HallucinationIssue[] = [];

    // 1+4. 主体名词溯源 + 时间线复用（生成场景）
    if (params.originalInput && params.draft) {
      issues.push(...checkEntities(params.draft, params.originalInput));
      issues.push(...checkSkills(params.draft, params.originalInput));
    }
    issues.push(...checkTimeline(params.originalInput));

    // 3. 量化数字标记（双场景，生成场景用 draft，上传场景用 markdown）
    issues.push(...checkMetrics(params.draft, params.resumeMarkdown));

    // 计算分数
    let score = 100;
    for (const issue of issues) {
      score -= SEVERITY_DEDUCTION[issue.severity];
    }
    score = Math.max(0, score);

    // 生成 summary
    const counts: Record<HallucinationIssueType, number> = {
      fabricated_entity: 0,
      fabricated_skill: 0,
      unsupported_metric: 0,
      timeline_mismatch: 0,
    };
    for (const issue of issues) counts[issue.type] += 1;

    const parts: string[] = [];
    if (counts.fabricated_entity > 0) parts.push(`${counts.fabricated_entity} 处疑似编造主体`);
    if (counts.fabricated_skill > 0) parts.push(`${counts.fabricated_skill} 处疑似编造技能`);
    if (counts.unsupported_metric > 0) parts.push(`${counts.unsupported_metric} 处未溯源量化数据`);
    if (counts.timeline_mismatch > 0) parts.push(`${counts.timeline_mismatch} 处时间线冲突`);

    const summary =
      parts.length === 0
        ? `未检测到幻觉风险，可信度 ${score}/100`
        : `检测到 ${parts.join('、')}，可信度 ${score}/100`;

    return { score, issues, summary };
  },
};
