import type { DimensionScore, ScoringDimension } from '../types/resume';

interface ScoreCardProps {
  dimension: DimensionScore;
}

const DIMENSION_LABEL: Record<ScoringDimension, string> = {
  position_match: '岗位匹配度',
  experience_quantification: '经历量化度',
  logical_clarity: '逻辑清晰度',
  keyword_match: '关键词匹配度',
};

const scoreColor = (score: number): string => {
  if (score >= 80) return 'var(--color-success)';
  if (score >= 60) return 'var(--color-warning)';
  return 'var(--color-danger)';
};

const ScoreCard = ({ dimension }: ScoreCardProps) => {
  const label = DIMENSION_LABEL[dimension.dimension];
  const color = scoreColor(dimension.score);

  return (
    <div className="score-card">
      <div className="score-card__head">
        <span className="score-card__label">{label}</span>
        <span className="score-card__value" style={{ color }}>
          {dimension.score}
        </span>
      </div>
      <p className="score-card__comment">{dimension.comment}</p>
      {dimension.suggestions.length > 0 && (
        <ul className="score-card__suggestions">
          {dimension.suggestions.map((s, i) => (
            <li key={i}>
              <div className="suggestion">
                <span className="suggestion__location">{s.location}</span>
                <p className="suggestion__issue">问题：{s.issue}</p>
                <p className="suggestion__tip">建议：{s.suggestion}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ScoreCard;
