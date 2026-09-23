import { ChatDeepSeek } from '@langchain/deepseek';
import { config } from '../config/index.js';
import { ragService } from './rag.service.js';
import { createScoringPrompt } from '../utils/scoring-prompt.js';
import { ScoringJsonParser } from '../utils/scoring-parser.js';
import { computeRuleMetrics, renderObjectiveFacts } from '../utils/rule-engine.js';
import { renderTimelineFacts } from '../utils/timeline.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import type { RetrievedChunk, KnowledgeCategory } from '../types/rag.types.js';
import type {
  DimensionScore,
  ScoringAnalysisResult,
  ScoringInput,
  ScoringResult,
} from '../types/scoring.types.js';
import type { RetrievedReference } from '../types/resume.types.js';

/** 把检索片段拼成供 LLM 参考的上下文文本 */
function buildContextText(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return '（无相关检索结果）';
  return chunks
    .map((chunk, index) => {
      const meta = chunk.metadata;
      return `--- 片段 ${index + 1}（来源: ${meta.source} | 分类: ${meta.category}）---\n${chunk.content}`;
    })
    .join('\n\n');
}

/** 维度加权权重：岗位匹配 30% / 经历量化 30% / 逻辑清晰 20% / 关键词 20% */
const DIMENSION_WEIGHTS = {
  position_match: 0.3,
  experience_quantification: 0.3,
  logical_clarity: 0.2,
  keyword_match: 0.2,
} as const;

/**
 * HR 评分服务（规则引擎 + LLM 混合架构）：
 * 1. RAG 检索 HR 标准与 JD 关键词；
 * 2. 规则引擎代码精确计算量化率/关键词覆盖率（确定性、可复现）；
 * 3. LLM（temperature=0）只评岗位匹配/逻辑清晰度两个主观维度，并为各维度写评语建议；
 * 4. 总分由代码加权计算，时间线事实由生成环节透传，LLM 无权更改。
 */
export const scoringService = {
  async analyze(input: ScoringInput): Promise<ScoringAnalysisResult> {
    if (!config.deepseek.apiKey) {
      throw new AppError(
        ErrorCode.CONFIG_ERROR,
        500,
        'DEEPSEEK_API_KEY 未配置，无法调用 AI 模型',
      );
    }

    // 1. RAG 双路检索：JD 路取较大 topK 以覆盖完整关键词库
    const [hrChunks, jdChunks] = await Promise.all([
      ragService.retrieve(input.targetPosition, {
        categories: ['hr-standards' as KnowledgeCategory],
      }),
      ragService.retrieve(input.targetPosition, {
        categories: ['job-descriptions' as KnowledgeCategory],
        k: 8,
      }),
    ]);

    const references: RetrievedReference[] = [...hrChunks, ...jdChunks].map((chunk) => ({
      category: chunk.metadata.category,
      title: chunk.metadata.title,
      source: chunk.metadata.source,
      score: chunk.score,
      content: chunk.content,
    }));

    // 2. 规则引擎：客观指标代码精确统计
    const jdText = buildContextText(jdChunks);
    const metrics = computeRuleMetrics(jdText, input.resumeMarkdown);

    // 3. 构建 LLM（评分类任务 temperature=0，最大限度保证可复现）
    const llmOptions: ConstructorParameters<typeof ChatDeepSeek>[0] = {
      model: config.deepseek.modelName,
      apiKey: config.deepseek.apiKey,
      temperature: 0,
      streaming: false,
    };
    if (config.deepseek.baseUrl) {
      llmOptions.configuration = { baseURL: config.deepseek.baseUrl };
    }
    const llm = new ChatDeepSeek(llmOptions);

    // 4. LCEL 链：prompt | llm | parser
    const prompt = createScoringPrompt();
    const parser = new ScoringJsonParser();
    const chain = prompt.pipe(llm).pipe(parser);

    let draft;
    try {
      draft = await chain.invoke({
        targetPosition: input.targetPosition,
        timelineFacts: renderTimelineFacts(input.timelineReport),
        objectiveFacts: renderObjectiveFacts(metrics),
        hrContext: buildContextText(hrChunks),
        jdContext: jdText,
        resumeMarkdown: input.resumeMarkdown,
        formatInstructions: parser.getFormatInstructions(),
      });
    } catch (error) {
      throw new AppError(
        ErrorCode.AI_UPSTREAM_ERROR,
        502,
        'AI 模型调用或输出解析失败',
        error instanceof Error ? error.message : undefined,
      );
    }

    // 5. 组装最终评分：客观分覆盖 LLM 文本，主观分取 LLM，总分代码加权
    const dimensions: DimensionScore[] = [
      {
        dimension: 'position_match',
        score: draft.position_match.score,
        comment: draft.position_match.comment,
        suggestions: draft.position_match.suggestions,
      },
      {
        dimension: 'experience_quantification',
        score: metrics.quantification.score,
        comment: draft.experience_quantification.comment,
        suggestions: draft.experience_quantification.suggestions,
      },
      {
        dimension: 'logical_clarity',
        score: draft.logical_clarity.score,
        comment: draft.logical_clarity.comment,
        suggestions: draft.logical_clarity.suggestions,
      },
      {
        dimension: 'keyword_match',
        score: metrics.keyword.coverage,
        comment: draft.keyword_match.comment,
        suggestions: draft.keyword_match.suggestions,
      },
    ];

    const overall = Math.round(
      dimensions.reduce(
        (sum, item) => sum + item.score * DIMENSION_WEIGHTS[item.dimension],
        0,
      ),
    );

    const scoring: ScoringResult = {
      dimensions,
      overall,
      summary: draft.summary,
    };

    return { scoring, references, generatedAt: new Date().toISOString() };
  },
};
