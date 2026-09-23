import { ResumeProvider, useResume } from './context/ResumeContext';
import FormPage from './pages/FormPage';
import ResumePage from './pages/ResumePage';
import ScoringPage from './pages/ScoringPage';
import AtsPage from './pages/AtsPage';
import UploadPage from './pages/UploadPage';

const AppInner = () => {
  const { page, error, loading, clearError } = useResume();

  return (
    <div className="app">
      <header className="app-header">
        <h1>Resume Forge</h1>
        <p>应届生 AI 简历生成系统 · 校园经历职场化翻译 + HR 评分 + ATS 检测</p>
      </header>

      {error && (
        <div className="app-error">
          <span>{error}</span>
          <button type="button" className="app-error__close" onClick={clearError}>
            ×
          </button>
        </div>
      )}

      {loading && <div className="app-loading">处理中，请稍候…</div>}

      <main className="app-main">
        {page === 'form' && <FormPage />}
        {page === 'upload' && <UploadPage />}
        {page === 'resume' && <ResumePage />}
        {page === 'scoring' && <ScoringPage />}
        {page === 'ats' && <AtsPage />}
      </main>

      <footer className="app-footer">
        <span>仅用于学习与求职辅助 · 不存储任何数据 · 调用结果请自行核对</span>
      </footer>
    </div>
  );
};

const App = () => (
  <ResumeProvider>
    <AppInner />
  </ResumeProvider>
);

export default App;
