import type { AtsFormatIssue, AtsFormatIssueType } from '../types/ats.types.js';

/**
 * 简历客观指标规则引擎。
 * 设计原则：凡是可以从文本确定性计算的指标（关键词覆盖、bullet 量化率、
 * 信息完整性、markdown 格式风险），一律由代码计算，LLM 只负责解读与建议。
 * 同样的输入永远得到同样的分数，从根上消除评分波动。
 */

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

export interface KeywordMetric {
  /** 从 JD 知识中抽取出的全部考核关键词 */
  keywords: string[];
  covered: string[];
  missing: string[];
  /** 0-100 覆盖率 */
  coverage: number;
}

export interface QuantificationMetric {
  /** 经历 bullet 总数（不含技能清单） */
  totalBullets: number;
  /** 含量化信息的 bullet 数 */
  quantifiedBullets: number;
  /** 0-100 量化比例 */
  ratioPct: number;
  /** 0-100 量化度得分（20 分结构基础分 + 量化率映射） */
  score: number;
  /** 未量化 bullet 示例（供 LLM 给出针对性建议） */
  samples: string[];
}

export interface InfoCompletenessMetric {
  presentFields: string[];
  missingFields: string[];
  score: number;
}

export interface FormatMetric {
  issues: AtsFormatIssue[];
  score: number;
}

export interface ResumeRuleMetrics {
  keyword: KeywordMetric;
  quantification: QuantificationMetric;
  info: InfoCompletenessMetric;
  format: FormatMetric;
}

// ---------------------------------------------------------------------------
// 文本归一化与关键词抽取
// ---------------------------------------------------------------------------

/**
 * 归一化用于关键词匹配：小写化并移除空白与弱符号（. _ - / 等），
 * 保留 + #（避免 C++ / C# 语义丢失）。
 * 例：'Spring Boot' → 'springboot'，'CI/CD' → 'cicd'，'Node.js' → 'nodejs'。
 */
export function normalizeKeyword(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s._\-/\\，,、；;（）()]/g, '');
}

/** JD 栏目名 / 整句动词黑名单：这些行不是关键词枚举，整行丢弃 */
const SECTION_BLACKLIST = new Set([
  '核心技术栈',
  '常见要求关键词',
  '项目经验加分项',
  '常见面试考点',
]);

const SENTENCE_VERB_PREFIX =
  /^(参与|有|具备|熟悉|了解|掌握|负责|常见|要求|加分|建议|能够|善于|优先|擅长)/;

/**
 * 从 JD markdown 文本中抽取技术关键词。
 * 输入通常是 RAG 检索到的 JD 分类片段拼接（topK 已覆盖整个 JD 文件）。
 */
export function extractKeywords(jdText: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const rawLine of jdText.split('\n')) {
    let line = rawLine.trim();
    if (!line) continue;
    // 丢弃 markdown 标题行
    if (line.startsWith('#')) continue;
    // 丢弃前导列表符号
    line = line.replace(/^[-*]\s*/, '');
    // 整句动词开头的描述行（如「参与过完整项目周期…」）不是关键词枚举
    if (SENTENCE_VERB_PREFIX.test(line)) continue;

    // 括号内往往也是枚举（如「并发编程（线程池、锁、CAS）」），统一替换为分隔符
    const expanded = line.replace(/[（(]/g, '、').replace(/[）)]/g, '');
    const tokens = expanded.split(/[、,，;；/]/);

    for (const rawToken of tokens) {
      const token = rawToken.trim().replace(/[。.；;：:]+$/, '');
      if (token.length < 2 || token.length > 30) continue;
      if (token.includes('→') || token.includes('-') && token.length <= 2) continue;
      if (SECTION_BLACKLIST.has(token)) continue;
      // 必须含英文字母或至少 2 个中文字符，过滤残句/纯标点
      const chineseCount = (token.match(/[一-龥]/g) ?? []).length;
      const hasLetter = /[A-Za-z]/.test(token);
      if (!hasLetter && chineseCount < 2) continue;

      const key = normalizeKeyword(token);
      if (key.length < 2 || seen.has(key)) continue;
      seen.add(key);
      result.push(token);
    }
  }

  return result;
}

/** 统计简历 markdown 对 JD 关键词的字面覆盖率（归一化包含匹配） */
export function computeKeywordCoverage(jdText: string, resumeMarkdown: string): KeywordMetric {
  const keywords = extractKeywords(jdText);
  const haystack = normalizeKeyword(resumeMarkdown);
  const covered: string[] = [];
  const missing: string[] = [];
  for (const keyword of keywords) {
    if (haystack.includes(normalizeKeyword(keyword))) {
      covered.push(keyword);
    } else {
      missing.push(keyword);
    }
  }
  const coverage =
    keywords.length === 0 ? 0 : Math.round((covered.length / keywords.length) * 100);
  return { keywords, covered, missing, coverage };
}

// ---------------------------------------------------------------------------
// 经历量化率
// ---------------------------------------------------------------------------

// 兼容 markdown 列表（- *）、纯文本简历常见符号（• ·）与短序号（1. 1、）。
// 序号限定 1-2 位数字，避免「2023.09 - 2027.06」这类日期行被误判为列表项。
const BULLET_PATTERN = /^\s*(?:[-*•·]|\d{1,2}[.、)）]|（\d+）)\s*(.+)$/;

/** 纯文本简历（如 PDF 直接提取）的独立标题行：无 ## 前缀，整行仅为栏目名 */
const PLAIN_HEADING_PATTERN =
  /^(教育背景|教育经历|实习经历|实习经验|项目经历|项目经验|工作经历|工作经验|校园经历|社团经历|实践经历|专业技能|技能特长|技能清单|IT技能|个人优势|自我评价|求职意向|荣誉奖项|获奖经历|证书资格)\s*[：:]?$/;

/**
 * 阿拉伯数字，或中文数字 + 强量词。
 * 刻意不收录「个/项/条」等弱量词（「四个维度」「一个问题」不是业务量化），
 * 只保留名/人/次/倍/万/千/百、时间与性能单位等强量化信号。
 */
const QUANTIFIED_PATTERN =
  /\d|[一二两三四五六七八九十百千万亿]\s*(?:名|人|次|倍|万|千|百|分|小时|天|周|月|年|%|％|QPS|TPS)/;

/** 按 ## 二级标题分段；纯文本简历的独立栏目行（如「教育经历」）也视为分段标题 */
function splitSections(markdown: string): { heading: string; body: string }[] {
  const sections: { heading: string; body: string }[] = [];
  let currentHeading = '';
  let buffer: string[] = [];
  const flush = () => {
    sections.push({ heading: currentHeading, body: buffer.join('\n') });
    buffer = [];
  };
  for (const line of markdown.split('\n')) {
    const trimmed = line.trim();
    const headingMatch = /^##\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      flush();
      currentHeading = headingMatch[1];
    } else if (PLAIN_HEADING_PATTERN.test(trimmed)) {
      flush();
      currentHeading = trimmed.replace(/\s*[：:]$/, '');
    } else {
      buffer.push(line);
    }
  }
  flush();
  return sections;
}

/**
 * 计算经历 bullet 的量化率。技能清单等枚举型 bullet 不计入分母。
 */
export function computeQuantification(resumeMarkdown: string): QuantificationMetric {
  // 无标题段是联系人信息等前导内容，技能清单是枚举：都不计入经历统计
  const sections = splitSections(resumeMarkdown).filter(
    (section) => section.heading !== '' && !section.heading.includes('技能'),
  );

  let bullets: string[] = [];
  for (const section of sections) {
    for (const line of section.body.split('\n')) {
      const matched = BULLET_PATTERN.exec(line);
      if (matched) bullets.push(matched[1].trim());
    }
  }

  // 纯文本简历（如 PDF 提取）可能完全没有列表符号：
  // 退化为按行统计，每行视为一条表述，避免量化度被误判为 0。
  if (bullets.length === 0) {
    bullets = [];
    for (const section of sections) {
      for (const line of section.body.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || PLAIN_HEADING_PATTERN.test(trimmed)) {
          continue;
        }
        bullets.push(trimmed);
      }
    }
  }

  const quantified = bullets.filter((bullet) => QUANTIFIED_PATTERN.test(bullet));
  const ratio = bullets.length === 0 ? 0 : quantified.length / bullets.length;
  return {
    totalBullets: bullets.length,
    quantifiedBullets: quantified.length,
    ratioPct: Math.round(ratio * 100),
    // 20 分结构基础分（有 bullet 结构）+ 75 分量化映射，满分 95，保留人工上升空间
    score: bullets.length === 0 ? 0 : Math.min(95, Math.round(20 + ratio * 75)),
    samples: bullets
      .filter((bullet) => !QUANTIFIED_PATTERN.test(bullet))
      .slice(0, 3)
      .map((bullet) => (bullet.length > 60 ? `${bullet.slice(0, 60)}…` : bullet)),
  };
}

// ---------------------------------------------------------------------------
// 关键信息完整性
// ---------------------------------------------------------------------------

interface InfoFieldRule {
  label: string;
  present: (sections: { heading: string; body: string }[], fullText: string) => boolean;
}

function hasSectionEntry(sections: { heading: string; body: string }[], keyword: string): boolean {
  const section = sections.find((item) => item.heading.includes(keyword));
  if (!section) return false;
  if (/^###\s+/m.test(section.body.trim())) return true;
  // 纯文本简历：小节内存在非空、非列表、非栏目标题的行即视为有经历条目
  return section.body
    .split('\n')
    .some((line) => {
      const trimmed = line.trim();
      return (
        trimmed.length > 0 &&
        !BULLET_PATTERN.test(line) &&
        !PLAIN_HEADING_PATTERN.test(trimmed)
      );
    });
}

/** 纯文本简历的姓名启发式：首个非空行为 2-4 个中文字符（排除「个人简历」等通用词） */
function hasPlainName(fullText: string): boolean {
  const firstLine = fullText
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) return false;
  if (/^(个人简历|简历|个人简历模板|resume)$/i.test(firstLine)) return false;
  return /^[一-龥]{2,4}$/.test(firstLine);
}

const FIELD_RULES: InfoFieldRule[] = [
  { label: '姓名', present: (_sections, full) => /^#\s+\S+/m.test(full) || hasPlainName(full) },
  { label: '电话', present: (_sections, full) => /1[3-9]\d{9}/.test(full) },
  { label: '邮箱', present: (_sections, full) => /[\w.+-]+@[\w-]+\.[\w.-]+/.test(full) },
  { label: '教育经历', present: (sections) => hasSectionEntry(sections, '教育') },
  {
    label: '实习/项目经历',
    present: (sections) =>
      hasSectionEntry(sections, '实习') || hasSectionEntry(sections, '项目'),
  },
  {
    label: '技能清单',
    present: (sections) => {
      const section = sections.find((item) => item.heading.includes('技能'));
      if (!section) return false;
      if (/^\s*[-*]\s+/m.test(section.body)) return true;
      // 纯文本简历：技能常为一行「A、B、C」或「A / B / C」枚举
      return /[、,，/]/.test(section.body.trim());
    },
  },
];

export function computeInfoCompleteness(resumeMarkdown: string): InfoCompletenessMetric {
  const sections = splitSections(resumeMarkdown);
  const presentFields: string[] = [];
  const missingFields: string[] = [];
  for (const rule of FIELD_RULES) {
    if (rule.present(sections, resumeMarkdown)) {
      presentFields.push(rule.label);
    } else {
      missingFields.push(rule.label);
    }
  }
  const score = Math.round((presentFields.length / FIELD_RULES.length) * 100);
  return { presentFields, missingFields, score };
}

// ---------------------------------------------------------------------------
// markdown 格式风险（ATS 解析失败的常见来源）
// ---------------------------------------------------------------------------

function pushFormatIssue(
  issues: AtsFormatIssue[],
  type: AtsFormatIssueType,
  location: string,
  issue: string,
  fix: string,
): void {
  // 同类问题只报一次，避免噪声
  if (issues.some((item) => item.type === type)) return;
  issues.push({ type, location, issue, fix });
}

export function computeFormatCompatibility(resumeMarkdown: string): FormatMetric {
  const issues: AtsFormatIssue[] = [];

  if (/```/.test(resumeMarkdown)) {
    pushFormatIssue(
      issues,
      'special_character',
      '全文',
      '简历包含代码块（```），多数 ATS 无法正确提取其中文本',
      '将代码块改为普通行内文本，或拆成技能/要点描述',
    );
  }

  // GFM 表格必须存在 | --- | --- | 形式的分隔行；
  // 仅用「|」分隔联系方式/标题（如 "电话 | 邮箱"）不算表格，避免误报。
  const tableSeparatorPattern = /^\s*\|?(?:\s*:?-{2,}:?\s*\|)+\s*:?-{2,}:?\s*\|?\s*$/m;
  if (tableSeparatorPattern.test(resumeMarkdown)) {
    pushFormatIssue(
      issues,
      'complex_table',
      '全文',
      '简历使用表格模拟排版，ATS 解析单元格文本时容易错列或丢失',
      '改为线性的标题 + 要点结构，不要用表格承载正文',
    );
  }

  if (/<img\b/i.test(resumeMarkdown)) {
    pushFormatIssue(
      issues,
      'image_text',
      '全文',
      '存在 HTML 图片标签，图片内文字无法被 ATS 读取',
      '关键信息必须以纯文本呈现，图片仅作装饰或不放',
    );
  }

  if (/<(?:table|div|span|svg)\b/i.test(resumeMarkdown)) {
    pushFormatIssue(
      issues,
      'other',
      '全文',
      '存在 HTML 布局标签，打印为 PDF 后 ATS 可能无法按阅读顺序提取文本',
      '导出 PDF 时保持单栏线性排版，避免绝对定位与 HTML 布局',
    );
  }

  if (
    /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u.test(resumeMarkdown) ||
    /[★☆✓✔●◆■►▶✘✗■]/u.test(resumeMarkdown)
  ) {
    pushFormatIssue(
      issues,
      'special_character',
      '全文',
      '存在 emoji 或装饰性特殊符号，部分 ATS 解析为乱码',
      '用普通文字或标准列表符号（-）替代装饰符号',
    );
  }

  // markdown 简历无法检测页眉页脚/多栏等打印层问题：不臆造、不误报。
  const score = issues.length === 0 ? 100 : Math.max(40, 100 - issues.length * 15);
  return { issues, score };
}

// ---------------------------------------------------------------------------
// 聚合入口
// ---------------------------------------------------------------------------

export function computeRuleMetrics(
  jdText: string,
  resumeMarkdown: string,
): ResumeRuleMetrics {
  return {
    keyword: computeKeywordCoverage(jdText, resumeMarkdown),
    quantification: computeQuantification(resumeMarkdown),
    info: computeInfoCompleteness(resumeMarkdown),
    format: computeFormatCompatibility(resumeMarkdown),
  };
}

/** ATS 过检概率：客观三项加权（关键词 40% / 格式 30% / 信息 30%） */
export function computePassProbability(metrics: ResumeRuleMetrics): number {
  return Math.round(
    metrics.keyword.coverage * 0.4 + metrics.format.score * 0.3 + metrics.info.score * 0.3,
  );
}

/** 把 ATS 客观检测结果渲染为注入 LLM 的「既定事实」文本 */
export function renderAtsFacts(metrics: ResumeRuleMetrics, passProbability: number): string {
  const { keyword, format, info } = metrics;
  const lines: string[] = [
    '以下结果由系统代码基于简历 markdown 精确检测，是不可更改的既定事实：',
    '',
    `1. 关键词覆盖率：抽取 JD 考核关键词 ${keyword.keywords.length} 个，命中 ${keyword.covered.length} 个，覆盖率 ${keyword.coverage}%。`,
    `   已命中：${keyword.covered.join('、') || '（无）'}`,
    `   未命中：${keyword.missing.join('、') || '（无）'}`,
    `2. 格式兼容性：${format.score}/100。`,
  ];
  if (format.issues.length === 0) {
    lines.push('   未发现 markdown 层面的 ATS 解析风险（表格/代码块/图片标签/装饰符号等）。');
  } else {
    for (const issue of format.issues) {
      lines.push(`   - [${issue.location}] ${issue.issue}（修复方向：${issue.fix}）`);
    }
  }
  lines.push(
    `3. 信息完整性：${info.score}/100。已具备：${info.presentFields.join('、') || '（无）'}；缺失：${info.missingFields.join('、') || '（无）'}。`,
    `4. 过检概率（系统按 关键词40% + 格式30% + 信息30% 加权）：${passProbability}/100。`,
  );
  return lines.join('\n');
}

/** 把客观指标渲染为注入 LLM 的「既定事实」文本 */
export function renderObjectiveFacts(metrics: ResumeRuleMetrics): string {
  const { keyword, quantification, info } = metrics;
  const lines: string[] = [
    '以下指标由系统代码基于简历文本精确统计，是不可更改的既定事实，',
    '你写评语与建议时必须引用并严格对齐这些数字，禁止给出与之矛盾的判断：',
    '',
    `【经历量化率】经历 bullet 共 ${quantification.totalBullets} 条，其中含量化信息的 ${quantification.quantifiedBullets} 条，量化比例 ${quantification.ratioPct}%，量化度得分 ${quantification.score}/100。`,
  ];
  if (quantification.samples.length > 0) {
    lines.push(`未量化 bullet 示例（不得杜撰其中不存在的数字）：${quantification.samples.map((item) => `「${item}」`).join('；')}`);
  }
  lines.push(
    '',
    `【关键词覆盖】系统抽取 JD 考核关键词 ${keyword.keywords.length} 个，简历命中 ${keyword.covered.length} 个，覆盖率 ${keyword.coverage}%。`,
  );
  if (keyword.covered.length > 0) {
    lines.push(`已命中：${keyword.covered.join('、') || '（无）'}`);
  }
  if (keyword.missing.length > 0) {
    lines.push(`未命中：${keyword.missing.join('、')}`);
  }
  lines.push(
    '',
    `【信息完整性】已具备字段：${info.presentFields.join('、') || '（无）'}；缺失字段：${info.missingFields.join('、') || '（无）'}，完整性得分 ${info.score}/100。`,
  );
  return lines.join('\n');
}
