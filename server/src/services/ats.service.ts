import { ChatDeepSeek } from '@langchain/deepseek';
import { config } from '../config/index.js';
import { ragService } from './rag.service.js';
import { createAtsPrompt } from '../utils/ats-prompt.js';
import { AtsJsonParser } from '../utils/ats-parser.js';
import {
  computePassProbability,
  computeRuleMetrics,
  renderAtsFacts,
} from '../utils/rule-engine.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import type { RetrievedChunk, KnowledgeCategory } from '../types/rag.types.js';
import type { AtsAnalysisResult, AtsInput, AtsResult } from '../types/ats.types.js';
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

/**
 * ATS 适配检测服务（规则引擎主导 + LLM 补充建议）：
 * 关键词覆盖率 / 格式兼容性 / 信息完整性 / 过检概率全部由代码确定性计算，
 * LLM（temperature=0）只基于客观事实输出可执行建议，保证同一份简历结果可复现。
 */
export const atsService = {
  async analyze(input: AtsInput): Promise<AtsAnalysisResult> {
    if (!config.deepseek.apiKey) {
      throw new AppError(
        ErrorCode.CONFIG_ERROR,
        500,
        'DEEPSEEK_API_KEY 未配置，无法调用 AI 模型',
      );
    }

    // 1. RAG 检索 JD 关键词（较大 topK 覆盖完整关键词库）
    const jdChunks = await ragService.retrieve(input.targetPosition, {
      categories: ['job-descriptions' as KnowledgeCategory],
      k: 8,
    });

    const references: RetrievedReference[] = jdChunks.map((chunk) => ({
      category: chunk.metadata.category,
      title: chunk.metadata.title,
      source: chunk.metadata.source,
      score: chunk.score,
      content: chunk.content,
    }));

    // 2. 规则引擎：三项客观指标 + 过检概率全部代码计算
    const jdText = buildContextText(jdChunks);
    const metrics = computeRuleMetrics(jdText, input.resumeMarkdown);
    const passProbability = computePassProbability(metrics);

    // 3. 构建 LLM（temperature=0，仅用于生成建议文案）
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
    const prompt = createAtsPrompt();
    const parser = new AtsJsonParser();
    const chain = prompt.pipe(llm).pipe(parser);

    let suggestions;
    try {
      suggestions = await chain.invoke({
        targetPosition: input.targetPosition,
        objectiveFacts: renderAtsFacts(metrics, passProbability),
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

    // 5. 组装最终结果（客观指标全部取规则引擎，LLM 仅提供建议）
    const ats: AtsResult = {
      keywordCoverage: {
        covered: metrics.keyword.covered,
        missing: metrics.keyword.missing,
        coverage: metrics.keyword.coverage,
      },
      formatCompatibility: {
        issues: metrics.format.issues,
        score: metrics.format.score,
      },
      infoCompleteness: {
        missingFields: metrics.info.missingFields,
        presentFields: metrics.info.presentFields,
        score: metrics.info.score,
      },
      passProbability,
      suggestions,
    };

    return { ats, references, generatedAt: new Date().toISOString() };
  },
};
