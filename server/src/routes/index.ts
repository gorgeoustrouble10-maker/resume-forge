import { Router } from 'express';
import {
  analyzeAts,
  analyzeScoring,
  generateResume,
  getKnowledgeStatus,
  ingestKnowledge,
  verifyHallucination,
} from '../controllers/resume.controller.js';

const router = Router();

// 健康检查（保留自第一步）
router.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok' } });
});

// 简历生成
router.post('/resume/generate', generateResume);

// 内容幻觉校验（生成场景内嵌，上传场景独立调用）
router.post('/resume/verify', verifyHallucination);

// 知识库管理
router.get('/knowledge/status', getKnowledgeStatus);
router.post('/knowledge/ingest', ingestKnowledge);

// HR 视角评分
router.post('/scoring/analyze', analyzeScoring);

// ATS 适配检测
router.post('/ats/analyze', analyzeAts);

export default router;
