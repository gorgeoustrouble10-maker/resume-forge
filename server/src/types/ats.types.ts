/**
 * ATS（Applicant Tracking System）适配检测相关类型定义。
 * 检测简历的关键词覆盖率、格式兼容性、关键信息完整性，
 * 给出过检概率与修改建议。
 */
import type { RetrievedReference } from './resume.types.js';

/** 关键词覆盖率检测结果 */
export interface KeywordCoverage {
  /** 已覆盖的 JD 关键词 */
  covered: string[];
  /** 缺失的关键词 */
  missing: string[];
  /** 0-100 覆盖率 */
  coverage: number;
}

/** ATS 格式问题类型 */
export type AtsFormatIssueType =
  | 'complex_table' // 复杂表格
  | 'image_text' // 图片内嵌文字
  | 'non_standard_font' // 非标准字体
  | 'special_character' // 特殊字符
  | 'multi_column' // 多栏布局
  | 'header_footer' // 页眉页脚关键信息
  | 'other';

/** 单条格式兼容性问题 */
export interface AtsFormatIssue {
  type: AtsFormatIssueType;
  location: string;
  issue: string;
  /** 修复建议 */
  fix: string;
}

/** 格式兼容性检测结果 */
export interface FormatCompatibility {
  issues: AtsFormatIssue[];
  /** 0-100 格式兼容性评分 */
  score: number;
}

/** 关键信息完整性检测结果 */
export interface InfoCompleteness {
  /** 缺失的关键字段 */
  missingFields: string[];
  /** 已具备的关键字段 */
  presentFields: string[];
  /** 0-100 完整性评分 */
  score: number;
}

/** 单条 ATS 修改建议 */
export interface AtsSuggestion {
  location: string;
  issue: string;
  suggestion: string;
}

/** ATS 检测的完整结果 */
export interface AtsResult {
  keywordCoverage: KeywordCoverage;
  formatCompatibility: FormatCompatibility;
  infoCompleteness: InfoCompleteness;
  /** 0-100，过 ATS 初筛的概率 */
  passProbability: number;
  /** 汇总修改建议 */
  suggestions: AtsSuggestion[];
}

/** ATS 检测接口请求体 */
export interface AtsInput {
  targetPosition: string;
  resumeMarkdown: string;
}

/** ATS 检测服务返回：检测结果 + 引用的知识片段（可解释性） */
export interface AtsAnalysisResult {
  ats: AtsResult;
  references: RetrievedReference[];
  /** 报告生成时间（ISO 字符串），用于前端留痕展示 */
  generatedAt: string;
}
