import { useResume } from '../context/ResumeContext';
import AtsReport from '../components/AtsReport';
import ReferenceList from '../components/ReferenceList';

const AtsPage = () => {
  const { atsResult, backFromReport, analysisOrigin, loading } = useResume();

  if (!atsResult) {
    return (
      <section className="page">
        <p className="page__empty">还没有 ATS 检测结果。</p>
        <button type="button" className="btn btn--primary" onClick={backFromReport}>
          返回
        </button>
      </section>
    );
  }

  const backLabel = analysisOrigin === 'upload' ? '返回上传页' : '返回简历';

  return (
    <section className="page">
      <div className="page__toolbar">
        <h2 className="page__title">ATS 适配检测</h2>
        <button type="button" className="btn btn--ghost" onClick={backFromReport} disabled={loading}>
          {backLabel}
        </button>
      </div>

      <p className="page__meta">
        报告生成时间：{new Date(atsResult.generatedAt).toLocaleString('zh-CN')}
        　·　覆盖率/格式/完整性指标由系统代码检测，同一份简历再次检测结果一致
      </p>

      <AtsReport ats={atsResult.ats} />

      <ReferenceList references={atsResult.references} />
    </section>
  );
};

export default AtsPage;
