/**
 * 内容幻觉校验类型定义。
 * 设计原则：所有指标由代码纯函数计算，不调 LLM，不参与主观判断。
 * 同样的输入永远得到同样的报告，从根上消除幻觉检测的随机性。
 */

/** 幻觉问题类型 */
export type HallucinationIssueType =
  /** 编造主体：公司/学校/项目名不在用户原始输入中找到对应来源 */
  | 'fabricated_entity'
  /** 编造技能：技能不在用户技能清单或常见同义词映射里 */
  | 'fabricated_skill'
  /** 未溯源量化数字：bullet 里的数字无法验证用户是否真有此数据 */
  | 'unsupported_metric'
  /** 时间线冲突：复用 validateTimeline 的确定性结论 */
  | 'timeline_mismatch';

/** 问题严重度 */
export type Severity = 'high' | 'medium' | 'low';

/** 单条幻觉问题 */
export interface HallucinationIssue {
  type: HallucinationIssueType;
  severity: Severity;
  /** 问题在结构化简历中的位置，如 "experiences[2].bullets[1]" */
  location: string;
  /** 问题原文片段 */
  evidence: string;
  /** 为什么标记 */
  explanation: string;
}

/** 幻觉校验报告 */
export interface HallucinationReport {
  /** 0-100，越高越可信（起点 100，按严重度扣分） */
  score: number;
  issues: HallucinationIssue[];
  /** 一句话总结 */
  summary: string;
}
