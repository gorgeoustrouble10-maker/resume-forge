import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  AtsAnalysisResult,
  EducationRecord,
  HallucinationReport,
  PersonalInfo,
  RawActivity,
  ResumeGenerationResult,
  ResumeInput,
  ScoringAnalysisResult,
  TimelineReport,
} from '../types/resume';
import { apiService } from '../services/api';
import {
  buildAnalysisKey,
  getCachedAnalysis,
  setCachedAnalysis,
} from '../utils/cache';

export type PageKey = 'form' | 'upload' | 'resume' | 'scoring' | 'ats';

/** 报告来源：生成的简历 / 上传的简历 */
export type AnalysisOrigin = 'resume' | 'upload';

export interface FormState {
  personalInfo: PersonalInfo;
  targetPosition: string;
  education: EducationRecord[];
  internships: RawActivity[];
  projects: RawActivity[];
  clubActivities: RawActivity[];
  skills: string[];
}

const emptyForm: FormState = {
  personalInfo: { name: '', phone: '', email: '' },
  targetPosition: '',
  education: [],
  internships: [],
  projects: [],
  clubActivities: [],
  skills: [],
};

interface ResumeContextValue {
  page: PageKey;
  setPage: (page: PageKey) => void;

  form: FormState;
  setForm: (updater: (prev: FormState) => FormState) => void;
  resetForm: () => void;

  resumeResult: ResumeGenerationResult | null;
  scoringResult: ScoringAnalysisResult | null;
  atsResult: AtsAnalysisResult | null;
  /** 上传场景独立调用幻觉校验的结果（生成场景直接读 resumeResult.hallucination） */
  hallucinationResult: HallucinationReport | null;

  loading: boolean;
  error: string | null;
  clearError: () => void;

  generateResume: () => Promise<void>;
  analyzeScoring: () => Promise<void>;
  analyzeAts: () => Promise<void>;
  /** 直接分析上传的简历原文（不经过表单与生成流程） */
  analyzeScoringDirect: (targetPosition: string, resumeText: string) => Promise<void>;
  analyzeAtsDirect: (targetPosition: string, resumeText: string) => Promise<void>;
  /** 上传场景独立调用幻觉校验（生成场景已在 resumeResult.hallucination 内嵌） */
  analyzeHallucinationDirect: (resumeText: string) => Promise<void>;

  /** 最近一次评分/ATS 报告的来源，用于报告页返回导航 */
  analysisOrigin: AnalysisOrigin;
  backToResume: () => void;
  backFromReport: () => void;
}

const ResumeContext = createContext<ResumeContextValue | null>(null);

export const ResumeProvider = ({ children }: { children: ReactNode }) => {
  const [page, setPage] = useState<PageKey>('form');
  const [form, setFormState] = useState<FormState>(emptyForm);
  const [resumeResult, setResumeResult] = useState<ResumeGenerationResult | null>(null);
  const [scoringResult, setScoringResult] = useState<ScoringAnalysisResult | null>(null);
  const [atsResult, setAtsResult] = useState<AtsAnalysisResult | null>(null);
  const [hallucinationResult, setHallucinationResult] = useState<HallucinationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisOrigin, setAnalysisOrigin] = useState<AnalysisOrigin>('resume');

  const setForm = (updater: (prev: FormState) => FormState) => {
    setFormState((prev) => updater(prev));
  };

  const resetForm = () => {
    setFormState(emptyForm);
    setResumeResult(null);
    setScoringResult(null);
    setAtsResult(null);
    setHallucinationResult(null);
    setError(null);
  };

  const toResumeInput = (form: FormState): ResumeInput => ({
    personalInfo: form.personalInfo,
    targetPosition: form.targetPosition,
    education: form.education,
    internships: form.internships.map((item, i) => ({
      ...item,
      id: item.id || `i${i + 1}`,
    })),
    projects: form.projects.map((p, i) => ({ ...p, id: p.id || `p${i + 1}` })),
    clubActivities: form.clubActivities.map((c, i) => ({
      ...c,
      id: c.id || `c${i + 1}`,
    })),
    skills: form.skills,
  });

  const generateResume = async () => {
    setLoading(true);
    setError(null);
    try {
      const input = toResumeInput(form);
      const result = await apiService.generateResume(input);
      setResumeResult(result);
      setScoringResult(null);
      setAtsResult(null);
      setHallucinationResult(null);
      setPage('resume');
    } catch (err) {
      setError(err instanceof Error ? err.message : '简历生成失败');
    } finally {
      setLoading(false);
    }
  };

  const runScoring = async (
    targetPosition: string,
    resumeMarkdown: string,
    timelineReport: TimelineReport | undefined,
    origin: AnalysisOrigin,
  ) => {
    setError(null);
    const cacheKey = buildAnalysisKey(
      'scoring',
      targetPosition,
      resumeMarkdown,
      JSON.stringify(timelineReport ?? null),
    );

    // 同一份简历直接复用本地报告：保证可复现、可留痕、不重复消耗模型调用
    const cached = getCachedAnalysis<ScoringAnalysisResult>(cacheKey);
    if (cached) {
      setScoringResult(cached.payload);
      setAnalysisOrigin(origin);
      setPage('scoring');
      return;
    }

    setLoading(true);
    try {
      const result = await apiService.analyzeScoring({
        targetPosition,
        resumeMarkdown,
        timelineReport,
      });
      setCachedAnalysis(cacheKey, result);
      setScoringResult(result);
      setAnalysisOrigin(origin);
      setPage('scoring');
    } catch (err) {
      setError(err instanceof Error ? err.message : '评分失败');
    } finally {
      setLoading(false);
    }
  };

  const analyzeScoring = async () => {
    if (!resumeResult) return;
    await runScoring(
      resumeResult.resume.targetPosition,
      resumeResult.resume.markdown,
      resumeResult.timeline,
      'resume',
    );
  };

  const analyzeScoringDirect = async (targetPosition: string, resumeText: string) => {
    if (!targetPosition.trim() || !resumeText.trim()) return;
    await runScoring(targetPosition.trim(), resumeText, undefined, 'upload');
  };

  const runAts = async (
    targetPosition: string,
    resumeMarkdown: string,
    origin: AnalysisOrigin,
  ) => {
    setError(null);
    const cacheKey = buildAnalysisKey('ats', targetPosition, resumeMarkdown);

    const cached = getCachedAnalysis<AtsAnalysisResult>(cacheKey);
    if (cached) {
      setAtsResult(cached.payload);
      setAnalysisOrigin(origin);
      setPage('ats');
      return;
    }

    setLoading(true);
    try {
      const result = await apiService.analyzeAts({
        targetPosition,
        resumeMarkdown,
      });
      setCachedAnalysis(cacheKey, result);
      setAtsResult(result);
      setAnalysisOrigin(origin);
      setPage('ats');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ATS 检测失败');
    } finally {
      setLoading(false);
    }
  };

  const analyzeAts = async () => {
    if (!resumeResult) return;
    await runAts(resumeResult.resume.targetPosition, resumeResult.resume.markdown, 'resume');
  };

  const analyzeAtsDirect = async (targetPosition: string, resumeText: string) => {
    if (!targetPosition.trim() || !resumeText.trim()) return;
    await runAts(targetPosition.trim(), resumeText, 'upload');
  };

  /** 上传场景独立调用幻觉校验：纯代码校验，不调 LLM，瞬时返回 */
  const analyzeHallucinationDirect = async (resumeText: string) => {
    if (!resumeText.trim()) return;
    setError(null);
    const cacheKey = buildAnalysisKey('hallucination', 'verify', resumeText);
    const cached = getCachedAnalysis<HallucinationReport>(cacheKey);
    if (cached) {
      setHallucinationResult(cached.payload);
      return;
    }
    setLoading(true);
    try {
      const result = await apiService.verifyHallucination({ resumeMarkdown: resumeText });
      setCachedAnalysis(cacheKey, result);
      setHallucinationResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '幻觉校验失败');
    } finally {
      setLoading(false);
    }
  };

  const backToResume = () => setPage('resume');

  const backFromReport = () => setPage(analysisOrigin === 'upload' ? 'upload' : 'resume');

  const value = useMemo<ResumeContextValue>(
    () => ({
      page,
      setPage,
      form,
      setForm,
      resetForm,
      resumeResult,
      scoringResult,
      atsResult,
      hallucinationResult,
      loading,
      error,
      clearError: () => setError(null),
      generateResume,
      analyzeScoring,
      analyzeAts,
      analyzeScoringDirect,
      analyzeAtsDirect,
      analyzeHallucinationDirect,
      analysisOrigin,
      backToResume,
      backFromReport,
    }),
    [
      page,
      form,
      resumeResult,
      scoringResult,
      atsResult,
      hallucinationResult,
      loading,
      error,
      analysisOrigin,
    ],
  );

  return <ResumeContext.Provider value={value}>{children}</ResumeContext.Provider>;
};

export const useResume = (): ResumeContextValue => {
  const ctx = useContext(ResumeContext);
  if (!ctx) {
    throw new Error('useResume 必须在 ResumeProvider 内使用');
  }
  return ctx;
};
