import { useState, type ChangeEvent } from 'react';
import { useResume } from '../context/ResumeContext';
import { extractPdfText } from '../utils/pdf-text';
import HallucinationReportView from '../components/HallucinationReport';

const UploadPage = () => {
  const { setPage, analyzeScoringDirect, analyzeAtsDirect, analyzeHallucinationDirect, loading, hallucinationResult } = useResume();
  const [targetPosition, setTargetPosition] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setParseError(null);
    setResumeText('');
    setFileName('');
    if (!file) return;
    if (!/\.pdf$/i.test(file.name)) {
      setParseError('请选择 PDF 文件');
      return;
    }
    setParsing(true);
    try {
      setResumeText(await extractPdfText(file));
      setFileName(file.name);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'PDF 解析失败');
    } finally {
      setParsing(false);
    }
  };

  const ready = Boolean(targetPosition.trim() && resumeText);

  return (
    <section className="page">
      <div className="page__toolbar">
        <h2 className="page__title">已有简历？直接分析</h2>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => setPage('form')}
          disabled={loading}
        >
          返回表单
        </button>
      </div>

      <div className="card upload-card">
        <div className="form-grid">
          <label className="field">
            <span>目标岗位 *</span>
            <input
              type="text"
              value={targetPosition}
              onChange={(e) => setTargetPosition(e.target.value)}
              placeholder="如：后端开发工程师 / 产品经理"
            />
          </label>
          <label className="field">
            <span>简历 PDF 文件 *</span>
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => void onFileChange(e)}
            />
          </label>
        </div>
        <p className="upload-hint">
          PDF 在你的浏览器本地解析，文件不会上传到服务器；暂不支持扫描/图片版简历。
          分析基于简历原文，不会改写内容。
        </p>
        {parsing && <p className="upload-status">正在解析 PDF…</p>}
        {parseError && <p className="upload-status upload-status--error">{parseError}</p>}
        {resumeText && !parseError && (
          <p className="upload-status">
            已解析「{fileName}」，共 {resumeText.length} 字，可以直接开始分析
          </p>
        )}
      </div>

      <div className="page__actions">
        <button
          type="button"
          className="btn btn--primary"
          disabled={!ready || loading || parsing}
          onClick={() => void analyzeScoringDirect(targetPosition.trim(), resumeText)}
        >
          {loading ? '分析中…' : 'HR 视角评分'}
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={!ready || loading || parsing}
          onClick={() => void analyzeAtsDirect(targetPosition.trim(), resumeText)}
        >
          {loading ? '检测中…' : 'ATS 适配检测'}
        </button>
        <button
          type="button"
          className="btn"
          disabled={!resumeText || loading || parsing}
          onClick={() => void analyzeHallucinationDirect(resumeText)}
          title="纯代码校验，不调 LLM，瞬时返回。仅检测量化数据是否溯源，无 originalInput 时跳过主体/技能/时间线校验"
        >
          {loading ? '检测中…' : '可信度检查'}
        </button>
      </div>

      {hallucinationResult && <HallucinationReportView report={hallucinationResult} />}
    </section>
  );
};

export default UploadPage;
