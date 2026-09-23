/**
 * 前端类型定义，与后端 server/src/types/*.types.ts 保持同步。
 * 前端独立部署，不通过 monorepo 共享类型，因此在此拷贝一份。
 */

/** 个人基本信息 */
export interface PersonalInfo {
  name: string;
  phone: string;
  email: string;
  city?: string;
  github?: string;
  blog?: string;
  /** 头像 dataURL（前端 Canvas 压缩后的 JPEG，格式形如 data:image/jpeg;base64,...） */
  avatar?: string;
}

/** 教育经历（用户原始输入） */
export interface EducationRecord {
  school: string;
  major: string;
  degree: string;
  startDate: string;
  endDate: string;
  gpa?: string;
  rank?: string;
  courses?: string[];
}

/** 校园经历原始输入（项目 / 社团共用） */
export interface RawActivity {
  /** 前端生成的临时 id（p1/p2 或 c1/c2），后端会按规则补全 */
  id: string;
  title: string;
  organization?: string;
  role?: string;
  startDate?: string;
  endDate?: string;
  description: string;
}

/** 简历生成接口请求体 */
export interface ResumeInput {
  personalInfo: PersonalInfo;
  targetPosition: string;
  education: EducationRecord[];
  internships: RawActivity[];
  projects: RawActivity[];
  clubActivities: RawActivity[];
  skills: string[];
}

/** 教育经历展示视图 */
export interface ResumeEducationView {
  school: string;
  major: string;
  degree: string;
  period: string;
  gpa?: string;
  rank?: string;
  courses?: string[];
}

export type ExperienceKind = 'internship' | 'project' | 'club';

/** 时间线校验报告（后端代码基于 YYYY-MM 精确比较的确定性事实） */
export type TimelineEntryKind = 'education' | ExperienceKind;

export interface TimelineIssue {
  kind: TimelineEntryKind;
  location: string;
  message: string;
}

export interface TimelineReport {
  checkedAt: string;
  ok: boolean;
  issues: TimelineIssue[];
}

/** STAR 化翻译后的单条职场经历 */
export interface ProfessionalExperience {
  id: string;
  kind: ExperienceKind;
  title: string;
  organization?: string;
  role?: string;
  period?: string;
  bullets: string[];
}

/** 完整简历结果 */
export interface GeneratedResume {
  targetPosition: string;
  personalInfo: PersonalInfo;
  summary: string;
  education: ResumeEducationView[];
  experiences: ProfessionalExperience[];
  skills: string[];
  markdown: string;
}

/** 引用的知识片段（可解释性） */
export interface RetrievedReference {
  category: string;
  title: string;
  source: string;
  score: number;
  content: string;
}

export interface ResumeGenerationResult {
  resume: GeneratedResume;
  references: RetrievedReference[];
  timeline: TimelineReport;
  /** 生成时同步完成的内容幻觉校验报告（可信度评分 + 疑似编造清单） */
  hallucination: HallucinationReport;
}

// ---------------------------------------------------------------------------
// 内容幻觉校验
// ---------------------------------------------------------------------------

export type HallucinationIssueType =
  | 'fabricated_entity'
  | 'fabricated_skill'
  | 'unsupported_metric'
  | 'timeline_mismatch';

export type Severity = 'high' | 'medium' | 'low';

export interface HallucinationIssue {
  type: HallucinationIssueType;
  severity: Severity;
  location: string;
  evidence: string;
  explanation: string;
}

export interface HallucinationReport {
  /** 0-100，越高越可信 */
  score: number;
  issues: HallucinationIssue[];
  summary: string;
}

export interface HallucinationVerifyInput {
  resumeMarkdown: string;
  originalInput?: ResumeInput;
}

/** 评分维度标识 */
export type ScoringDimension =
  | 'position_match'
  | 'experience_quantification'
  | 'logical_clarity'
  | 'keyword_match';

export interface ScoringSuggestion {
  location: string;
  issue: string;
  suggestion: string;
}

export interface DimensionScore {
  dimension: ScoringDimension;
  score: number;
  comment: string;
  suggestions: ScoringSuggestion[];
}

export interface ScoringResult {
  dimensions: DimensionScore[];
  overall: number;
  summary: string;
}

export interface ScoringInput {
  targetPosition: string;
  resumeMarkdown: string;
  timelineReport?: TimelineReport;
}

export interface ScoringAnalysisResult {
  scoring: ScoringResult;
  references: RetrievedReference[];
  generatedAt: string;
}

/** ATS 检测类型 */
export type AtsFormatIssueType =
  | 'complex_table'
  | 'image_text'
  | 'non_standard_font'
  | 'special_character'
  | 'multi_column'
  | 'header_footer'
  | 'other';

export interface KeywordCoverage {
  covered: string[];
  missing: string[];
  coverage: number;
}

export interface AtsFormatIssue {
  type: AtsFormatIssueType;
  location: string;
  issue: string;
  fix: string;
}

export interface FormatCompatibility {
  issues: AtsFormatIssue[];
  score: number;
}

export interface InfoCompleteness {
  missingFields: string[];
  presentFields: string[];
  score: number;
}

export interface AtsSuggestion {
  location: string;
  issue: string;
  suggestion: string;
}

export interface AtsResult {
  keywordCoverage: KeywordCoverage;
  formatCompatibility: FormatCompatibility;
  infoCompleteness: InfoCompleteness;
  passProbability: number;
  suggestions: AtsSuggestion[];
}

export interface AtsInput {
  targetPosition: string;
  resumeMarkdown: string;
}

export interface AtsAnalysisResult {
  ats: AtsResult;
  references: RetrievedReference[];
  generatedAt: string;
}

/** 统一响应包装 */
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
