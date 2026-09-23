import axios, { type AxiosInstance } from 'axios';
import type {
  ApiFailure,
  ApiSuccess,
  AtsAnalysisResult,
  AtsInput,
  HallucinationReport,
  HallucinationVerifyInput,
  ResumeGenerationResult,
  ResumeInput,
  ScoringAnalysisResult,
  ScoringInput,
} from '../types/resume';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

/** axios 实例：统一 baseURL，错误响应转成业务异常 message */
const instance: AxiosInstance = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 60000,
});

/** 把后端 ApiFailure 包装成可读的 Error，业务代码只 catch Error 即可 */
function toError(failure: ApiFailure, fallback: string): Error {
  const message = failure?.error?.message || fallback;
  const code = failure?.error?.code || 'UNKNOWN';
  return new Error(`[${code}] ${message}`);
}

export const apiService = {
  /** 简历生成：POST /api/resume/generate */
  async generateResume(input: ResumeInput): Promise<ResumeGenerationResult> {
    try {
      const { data } = await instance.post<ApiSuccess<ResumeGenerationResult>>(
        '/resume/generate',
        input,
      );
      return data.data;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data) {
        throw toError(err.response.data as ApiFailure, '简历生成失败');
      }
      throw new Error(err instanceof Error ? err.message : '简历生成失败');
    }
  },

  /** HR 评分：POST /api/scoring/analyze */
  async analyzeScoring(input: ScoringInput): Promise<ScoringAnalysisResult> {
    try {
      const { data } = await instance.post<ApiSuccess<ScoringAnalysisResult>>(
        '/scoring/analyze',
        input,
      );
      return data.data;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data) {
        throw toError(err.response.data as ApiFailure, '评分失败');
      }
      throw new Error(err instanceof Error ? err.message : '评分失败');
    }
  },

  /** ATS 检测：POST /api/ats/analyze */
  async analyzeAts(input: AtsInput): Promise<AtsAnalysisResult> {
    try {
      const { data } = await instance.post<ApiSuccess<AtsAnalysisResult>>(
        '/ats/analyze',
        input,
      );
      return data.data;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data) {
        throw toError(err.response.data as ApiFailure, 'ATS 检测失败');
      }
      throw new Error(err instanceof Error ? err.message : 'ATS 检测失败');
    }
  },

  /** 内容幻觉校验：POST /api/resume/verify */
  async verifyHallucination(input: HallucinationVerifyInput): Promise<HallucinationReport> {
    try {
      const { data } = await instance.post<ApiSuccess<HallucinationReport>>(
        '/resume/verify',
        input,
      );
      return data.data;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data) {
        throw toError(err.response.data as ApiFailure, '幻觉校验失败');
      }
      throw new Error(err instanceof Error ? err.message : '幻觉校验失败');
    }
  },
};
