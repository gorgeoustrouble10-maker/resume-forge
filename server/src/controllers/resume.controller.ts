import type { Response, Request } from 'express';
import { ragService } from '../services/rag.service.js';
import { resumeService } from '../services/resume.service.js';
import { scoringService } from '../services/scoring.service.js';
import { atsService } from '../services/ats.service.js';
import { hallucinationService } from '../services/hallucination.service.js';
import {
  validateAtsInput,
  validateHallucinationInput,
  validateResumeInput,
  validateScoringInput,
} from '../utils/validate.js';
import { asyncHandler, ok } from '../utils/errors.js';

/** 简历生成：POST /api/resume/generate */
export const generateResume = asyncHandler(async (req: Request, res: Response) => {
  const input = validateResumeInput(req.body);
  const result = await resumeService.generate(input);
  res.json(ok(result));
});

/** 知识库状态：GET /api/knowledge/status */
export const getKnowledgeStatus = asyncHandler(async (_req: Request, res: Response) => {
  const status = await ragService.status();
  res.json(ok(status));
});

/** 知识库灌库：POST /api/knowledge/ingest */
export const ingestKnowledge = asyncHandler(async (_req: Request, res: Response) => {
  const result = await ragService.ingest();
  res.json(ok(result));
});

/** HR 视角评分：POST /api/scoring/analyze */
export const analyzeScoring = asyncHandler(async (req: Request, res: Response) => {
  const input = validateScoringInput(req.body);
  const result = await scoringService.analyze(input);
  res.json(ok(result));
});

/** ATS 适配检测：POST /api/ats/analyze */
export const analyzeAts = asyncHandler(async (req: Request, res: Response) => {
  const input = validateAtsInput(req.body);
  const result = await atsService.analyze(input);
  res.json(ok(result));
});

/**
 * 内容幻觉校验：POST /api/resume/verify
 * - 生成场景：传 resumeMarkdown + originalInput，跑全部 4 类校验。
 * - 上传场景：只传 resumeMarkdown，降级只跑 unsupported_metric。
 */
export const verifyHallucination = asyncHandler(async (req: Request, res: Response) => {
  const { resumeMarkdown, originalInput } = validateHallucinationInput(req.body);
  const report = hallucinationService.verify({ resumeMarkdown, originalInput });
  res.json(ok(report));
});
