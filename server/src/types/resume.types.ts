/**
 * 简历生成业务的类型定义。
 * 输入对应用户在前端分步表单填写的原始信息；
 * 输出为 DeepSeek 将校园经历 STAR 化翻译后的结构化简历。
 */

import type { HallucinationReport } from './hallucination.types.js';

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
  /** 学历，如：本科 / 硕士 / 大专 */
  degree: string;
  startDate: string;
  endDate: string;
  gpa?: string;
  rank?: string;
  courses?: string[];
}

/**
 * 校园经历的原始输入（课程项目 / 社团活动共用）。
 * description 是学生口语化、流水账式的描述，等待 AI 做职场化翻译。
 */
export interface RawActivity {
  /** 前端传入的稳定 id，便于 AI 回传对应（projects 用 p1/p2...，社团用 c1/c2...） */
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
  /** 目标岗位名称，用于匹配 JD 关键词库（如：后端开发工程师） */
  targetPosition: string;
  education: EducationRecord[];
  /** 实习经历（应届生可以为空；在最终简历中权重高于项目/社团） */
  internships: RawActivity[];
  projects: RawActivity[];
  clubActivities: RawActivity[];
  skills: string[];
}

/** 教育经历展示视图（时间段由输入拼装，不交给模型臆造） */
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

/** 时间线条目类别（与经历板块一一对应） */
export type TimelineEntryKind = 'education' | ExperienceKind;

/** 单条时间线问题：由代码基于 YYYY-MM 精确比较得出，LLM 不得重新推断 */
export interface TimelineIssue {
  /** 问题所在板块 */
  kind: TimelineEntryKind;
  /** 人类可读的位置描述，如 "实习经历 - XX 公司"、"教育经历 #1" */
  location: string;
  /** 问题说明 */
  message: string;
}

/** 时间线校验报告（确定性事实） */
export interface TimelineReport {
  /** 校验执行时间（ISO 字符串，作为 LLM 评判日期的时间锚点） */
  checkedAt: string;
  /** 校验通过（无硬矛盾）时为 true */
  ok: boolean;
  issues: TimelineIssue[];
}

/** STAR 化翻译后的单条职场经历 */
export interface ProfessionalExperience {
  /** 对应 RawActivity.id */
  id: string;
  kind: ExperienceKind;
  title: string;
  organization?: string;
  role?: string;
  period?: string;
  /** 符合 STAR 法则、量化、HR 视角的职场表述要点 */
  bullets: string[];
}

/** LLM 输出（JSON 解析 + 校验后的草稿，markdown 由服务端确定性渲染） */
export interface ResumeDraft {
  /** 个人优势 / 求职概述（3-4 句） */
  summary: string;
  experiences: ProfessionalExperience[];
  /** 结合 JD 关键词归并后的技能清单 */
  skills: string[];
}

/** 完整简历结果 */
export interface GeneratedResume {
  targetPosition: string;
  personalInfo: PersonalInfo;
  summary: string;
  education: ResumeEducationView[];
  experiences: ProfessionalExperience[];
  skills: string[];
  /** 供前端导出的 markdown 全文 */
  markdown: string;
}

/** 生成结果引用的知识片段（可解释性：简历参考了哪些模板/JD） */
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
  /** 生成时同步完成的时间线硬校验结果（供前端提示与评分环节引用） */
  timeline: TimelineReport;
  /** 生成时同步完成的内容幻觉校验报告（可信度评分 + 疑似编造清单） */
  hallucination: HallucinationReport;
}
