import { useResume } from '../context/ResumeContext';
import ResumePreview from '../components/ResumePreview';
import ReferenceList from '../components/ReferenceList';
import HallucinationReportView from '../components/HallucinationReport';
import { downloadResumeMarkdown } from '../utils/download';

const ResumePage = () => {
  const { resumeResult, loading, analyzeScoring, analyzeAts, resetForm, setPage } = useResume();

  if (!resumeResult) {
    return (
      <section className="page">
        <p className="page__empty">还没有生成简历，请先填写表单。</p>
        <button type="button" className="btn btn--primary" onClick={() => setPage('form')}>
          去填写
        </button>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page__toolbar">
        <h2 className="page__title">生成结果</h2>
        <button type="button" className="btn btn--ghost" onClick={resetForm}>
          重新填写
        </button>
      </div>

      {!resumeResult.timeline.ok && (
        <div className="timeline-warning no-print">
          <p className="timeline-warning__title">
            系统检测到 {resumeResult.timeline.issues.length} 处时间线问题，请先核对再生成：
          </p>
          <ul>
            {resumeResult.timeline.issues.map((issue, index) => (
              <li key={index}>
                <span className="timeline-warning__location">{issue.location}</span>
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ResumePreview resume={resumeResult.resume} />

      {/* 内容幻觉校验报告：生成时已同步跑，直接渲染 */}
      <HallucinationReportView report={resumeResult.hallucination} />

      <div className="page__actions page__actions--export no-print">
        <button
          type="button"
          className="btn"
          onClick={() => downloadResumeMarkdown(resumeResult.resume)}
        >
          下载 Markdown
        </button>
        <button type="button" className="btn" onClick={() => window.print()}>
          打印为 PDF
        </button>
      </div>

      <div className="page__actions no-print">
        <button
          type="button"
          className="btn btn--primary"
          disabled={loading}
          onClick={() => void analyzeScoring()}
        >
          {loading ? '分析中…' : 'HR 视角评分'}
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={loading}
          onClick={() => void analyzeAts()}
        >
          {loading ? '检测中…' : 'ATS 适配检测'}
        </button>
      </div>

      <ReferenceList references={resumeResult.references} />
    </section>
  );
};

export default ResumePage;

