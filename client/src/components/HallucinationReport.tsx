import { useState } from 'react';
import type {
  HallucinationIssue,
  HallucinationIssueType,
  HallucinationReport as HallucinationReportType,
  Severity,
} from '../types/resume';

/** 问题类型 -> 中文标签 + 颜色 */
const TYPE_META: Record<HallucinationIssueType, { label: string; color: string }> = {
  fabricated_entity: { label: '编造主体', color: '#dc2626' },
  fabricated_skill: { label: '编造技能', color: '#d97706' },
  unsupported_metric: { label: '未溯源数据', color: '#2563eb' },
  timeline_mismatch: { label: '时间线冲突', color: '#dc2626' },
};

/** 严重度 -> 中文标签 */
const SEVERITY_LABEL: Record<Severity, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

/** 分数 -> 徽章等级（绿/黄/红） */
function scoreLevel(score: number): { label: string; bg: string; fg: string } {
  if (score >= 85) return { label: '高可信', bg: '#dcfce7', fg: '#15803d' };
  if (score >= 60) return { label: '中可信', bg: '#fef9c3', fg: '#a16207' };
  return { label: '低可信', bg: '#fee2e2', fg: '#b91c1c' };
}

interface Props {
  report: HallucinationReportType;
}

/** 可信度徽章 + 可折叠 issues 面板，被 ResumePage 与 UploadPage 共用 */
const HallucinationReportView = ({ report }: Props) => {
  const [expanded, setExpanded] = useState(false);
  const level = scoreLevel(report.score);

  return (
    <section className="hallucination no-print">
      <div
        className="hallucination__badge"
        style={{ backgroundColor: level.bg, color: level.fg }}
        onClick={() => setExpanded((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
      >
        <span className="hallucination__score">{report.score}</span>
        <span className="hallucination__level">{level.label}</span>
        <span className="hallucination__toggle">{expanded ? '收起 ▲' : '展开 ▼'}</span>
      </div>
      <p className="hallucination__summary">{report.summary}</p>

      {expanded && report.issues.length > 0 && (
        <ul className="hallucination__issues">
          {report.issues.map((issue: HallucinationIssue, idx: number) => {
            const meta = TYPE_META[issue.type];
            return (
              <li
                key={`${issue.type}-${idx}`}
                className="hallucination__issue"
                style={{ borderLeftColor: meta.color }}
              >
                <div className="hallucination__issue-header">
                  <span
                    className="hallucination__issue-type"
                    style={{ backgroundColor: meta.color }}
                  >
                    {meta.label}
                  </span>
                  <span className="hallucination__issue-severity">
                    严重度：{SEVERITY_LABEL[issue.severity]}
                  </span>
                  <code className="hallucination__issue-location">{issue.location}</code>
                </div>
                <div className="hallucination__issue-evidence">原文：「{issue.evidence}」</div>
                <div className="hallucination__issue-explanation">{issue.explanation}</div>
              </li>
            );
          })}
        </ul>
      )}

      {expanded && report.issues.length === 0 && (
        <p className="hallucination__empty">未检测到幻觉风险</p>
      )}
    </section>
  );
};

export default HallucinationReportView;
