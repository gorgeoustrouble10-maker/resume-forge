/**
 * HR 视角评分相关类型定义。
 * 从岗位匹配度、经历量化度、逻辑清晰度、关键词匹配度四个维度打分，
 * 每个维度附带评分理由与具体优化建议。
 */
import type { RetrievedReference, TimelineReport } from './resume.types.js';

/** 评分维度标识 */
export type ScoringDimension =
  | 'position_match' // 岗位匹配度
  | 'experience_quantification' // 经历量化度
  | 'logical_clarity' // 逻辑清晰度
  | 'keyword_match'; // 关键词匹配度

/** 单条优化建议：定位到简历中的具体位置，给出问题与修改方向 */
export interface ScoringSuggestion {
  /** 建议所针对的位置/段落标识，如 "项目-简历解析器"、"个人优势" */
  location: string;
  /** 当前存在的问题描述 */
  issue: string;
  /** 具体修改建议 */
  suggestion: string;
}

/** 单个维度的评分结果 */
export interface DimensionScore {
  dimension: ScoringDimension;
  /** 0-100 整数 */
  score: number;
  /** 评分理由（HR 视角的解释） */
  comment: string;
  suggestions: ScoringSuggestion[];
}

/** HR 视角评分的完整结果 */
export interface ScoringResult {
  /** 四维度明细 */
  dimensions: DimensionScore[];
  /** 加权总分（0-100） */
  overall: number;
  /** 总体评价（一段话总结） */
  summary: string;
}

/** 评分接口请求体 */
export interface ScoringInput {
  /** 目标岗位名称，用于匹配 JD 关键词 */
  targetPosition: string;
  /** 待评分的简历 markdown 全文 */
  resumeMarkdown: string;
  /** 简历生成时代码已完成的时间线校验事实（可选，缺省时不注入） */
  timelineReport?: TimelineReport;
}

/** 评分服务返回：评分结果 + 引用的知识片段（可解释性） */
export interface ScoringAnalysisResult {
  scoring: ScoringResult;
  references: RetrievedReference[];
  /** 报告生成时间（ISO 字符串），用于前端留痕展示 */
  generatedAt: string;
}
