import type { RetrievedReference } from '../types/resume';

interface ReferenceListProps {
  references: RetrievedReference[];
}

const CATEGORY_LABEL: Record<string, string> = {
  templates: '简历模板',
  'hr-standards': 'HR 评分标准',
  'job-descriptions': '岗位 JD',
};

const ReferenceList = ({ references }: ReferenceListProps) => {
  if (!references || references.length === 0) {
    return null;
  }

  return (
    <details className="references">
      <summary className="references__summary">
        知识库引用（{references.length} 条）：本次结果参考了以下片段
      </summary>
      <ul className="references__list">
        {references.map((ref, index) => (
          <li key={`${ref.source}-${index}`} className="references__item">
            <div className="references__head">
              <span className="tag">
                {CATEGORY_LABEL[ref.category] ?? ref.category}
              </span>
              <span className="references__title">{ref.title}</span>
              <span className="references__score">
                相似度 {(ref.score * 100).toFixed(1)}%
              </span>
            </div>
            <pre className="references__content">{ref.content}</pre>
          </li>
        ))}
      </ul>
    </details>
  );
};

export default ReferenceList;
