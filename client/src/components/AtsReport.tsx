import type { AtsFormatIssueType, AtsResult } from '../types/resume';

interface AtsReportProps {
  ats: AtsResult;
}

const ISSUE_TYPE_LABEL: Record<AtsFormatIssueType, string> = {
  complex_table: '复杂表格',
  image_text: '图片内嵌文字',
  non_standard_font: '非标准字体',
  special_character: '特殊字符',
  multi_column: '多栏布局',
  header_footer: '页眉页脚关键信息',
  other: '其他',
};

const scoreColor = (score: number): string => {
  if (score >= 80) return 'var(--color-success)';
  if (score >= 60) return 'var(--color-warning)';
  return 'var(--color-danger)';
};

const AtsReport = ({ ats }: AtsReportProps) => {
  const { keywordCoverage, formatCompatibility, infoCompleteness, passProbability, suggestions } =
    ats;

  return (
    <div className="ats-report">
      <div className="ats-overview">
        <div className="ats-overview__item" style={{ color: scoreColor(passProbability) }}>
          <span className="ats-overview__value">{passProbability}</span>
          <span className="ats-overview__label">过检概率</span>
        </div>
        <div className="ats-overview__item" style={{ color: scoreColor(keywordCoverage.coverage) }}>
          <span className="ats-overview__value">{keywordCoverage.coverage}</span>
          <span className="ats-overview__label">关键词覆盖率</span>
        </div>
        <div className="ats-overview__item" style={{ color: scoreColor(formatCompatibility.score) }}>
          <span className="ats-overview__value">{formatCompatibility.score}</span>
          <span className="ats-overview__label">格式兼容性</span>
        </div>
        <div className="ats-overview__item" style={{ color: scoreColor(infoCompleteness.score) }}>
          <span className="ats-overview__value">{infoCompleteness.score}</span>
          <span className="ats-overview__label">信息完整性</span>
        </div>
      </div>

      <section className="ats-section">
        <h3>关键词覆盖</h3>
        {keywordCoverage.covered.length > 0 && (
          <div className="ats-keywords">
            <span className="ats-keywords__label">已覆盖：</span>
            {keywordCoverage.covered.map((kw) => (
              <span key={kw} className="tag tag--ok">
                {kw}
              </span>
            ))}
          </div>
        )}
        {keywordCoverage.missing.length > 0 && (
          <div className="ats-keywords">
            <span className="ats-keywords__label">缺失：</span>
            {keywordCoverage.missing.map((kw) => (
              <span key={kw} className="tag tag--warn">
                {kw}
              </span>
            ))}
          </div>
        )}
        {keywordCoverage.covered.length === 0 && keywordCoverage.missing.length === 0 && (
          <p className="ats-empty">未提取到关键词</p>
        )}
      </section>

      {formatCompatibility.issues.length > 0 && (
        <section className="ats-section">
          <h3>格式兼容性问题</h3>
          <ul className="ats-issues">
            {formatCompatibility.issues.map((issue, i) => (
              <li key={i} className="ats-issue">
                <span className="tag tag--warn">
                  {ISSUE_TYPE_LABEL[issue.type] ?? issue.type}
                </span>
                <span className="ats-issue__location">{issue.location}</span>
                <p className="ats-issue__text">{issue.issue}</p>
                <p className="ats-issue__fix">修复：{issue.fix}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="ats-section">
        <h3>关键信息完整性</h3>
        {infoCompleteness.presentFields.length > 0 && (
          <div className="ats-keywords">
            <span className="ats-keywords__label">已具备：</span>
            {infoCompleteness.presentFields.map((f) => (
              <span key={f} className="tag tag--ok">
                {f}
              </span>
            ))}
          </div>
        )}
        {infoCompleteness.missingFields.length > 0 && (
          <div className="ats-keywords">
            <span className="ats-keywords__label">缺失：</span>
            {infoCompleteness.missingFields.map((f) => (
              <span key={f} className="tag tag--warn">
                {f}
              </span>
            ))}
          </div>
        )}
      </section>

      {suggestions.length > 0 && (
        <section className="ats-section">
          <h3>汇总修改建议</h3>
          <ul className="ats-issues">
            {suggestions.map((s, i) => (
              <li key={i} className="ats-issue">
                <span className="ats-issue__location">{s.location}</span>
                <p className="ats-issue__text">{s.issue}</p>
                <p className="ats-issue__fix">建议：{s.suggestion}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default AtsReport;
