import { useResume } from '../context/ResumeContext';
import ScoreCard from '../components/ScoreCard';
import ReferenceList from '../components/ReferenceList';

const ScoringPage = () => {
  const { scoringResult, backFromReport, analysisOrigin, loading } = useResume();

  if (!scoringResult) {
    return (
      <section className="page">
        <p className="page__empty">还没有评分结果。</p>
        <button type="button" className="btn btn--primary" onClick={backFromReport}>
          返回
        </button>
      </section>
    );
  }

  const backLabel = analysisOrigin === 'upload' ? '返回上传页' : '返回简历';

  const { scoring, references, generatedAt } = scoringResult;
  const overallColor =
    scoring.overall >= 80
      ? 'var(--color-success)'
      : scoring.overall >= 60
        ? 'var(--color-warning)'
        : 'var(--color-danger)';

  return (
    <section className="page">
      <div className="page__toolbar">
        <h2 className="page__title">HR 视角评分</h2>
        <button type="button" className="btn btn--ghost" onClick={backFromReport} disabled={loading}>
          {backLabel}
        </button>
      </div>

      <p className="page__meta">
        报告生成时间：{new Date(generatedAt).toLocaleString('zh-CN')}
        　·　量化率与关键词覆盖率由系统代码精确统计，同一份简历再次检测结果一致
      </p>

      <div className="overall">
        <div className="overall__score" style={{ color: overallColor }}>
          {scoring.overall}
        </div>
        <div className="overall__summary">
          <span className="overall__label">综合得分</span>
          <p>{scoring.summary}</p>
        </div>
      </div>

      <div className="score-grid">
        {scoring.dimensions.map((dim) => (
          <ScoreCard key={dim.dimension} dimension={dim} />
        ))}
      </div>

      <ReferenceList references={references} />
    </section>
  );
};

export default ScoringPage;
