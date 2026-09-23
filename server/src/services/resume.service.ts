import { config } from '../config/index.js';
import { ragService } from './rag.service.js';
import { hallucinationService } from './hallucination.service.js';
import { createResumePrompt } from '../utils/prompt-templates.js';
import { ResumeJsonParser } from '../utils/resume-parser.js';
import { renderResumeMarkdown, buildEducationView } from '../utils/resume-markdown.js';
import { validateTimeline } from '../utils/timeline.js';
import { AppError, ErrorCode } from '../utils/errors.js';
import type { RetrievedChunk } from '../types/rag.types.js';
import type {
  GeneratedResume,
  ProfessionalExperience,
  ResumeDraft,
  ResumeEducationView,
  ResumeGenerationResult,
  ResumeInput,
  RetrievedReference,
} from '../types/resume.types.js';
import type { KnowledgeCategory } from '../types/rag.types.js';
import { ChatDeepSeek } from '@langchain/deepseek';

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

/** 构建 LLM 输入用的用户信息 JSON（剔除空字段） */
function buildUserInputJson(input: ResumeInput): string {
  const simplified = {
    personalInfo: input.personalInfo,
    targetPosition: input.targetPosition,
    education: input.education.map((item) => ({
      school: item.school,
      major: item.major,
      degree: item.degree,
      period: `${item.startDate} - ${item.endDate}`,
      gpa: item.gpa,
      rank: item.rank,
      courses: item.courses,
    })),
    internships: input.internships,
    projects: input.projects,
    clubActivities: input.clubActivities,
    skills: input.skills,
  };
  return JSON.stringify(simplified, null, 2);
}

/** 把 Draft + 输入拼装为最终结构化简历 */
function assembleResume(
  input: ResumeInput,
  draft: ResumeDraft,
): GeneratedResume {
  const education: ResumeEducationView[] = buildEducationView(input.education);
  return {
    targetPosition: input.targetPosition,
    personalInfo: input.personalInfo,
    summary: draft.summary,
    education,
    experiences: draft.experiences,
    skills: draft.skills,
    markdown: '',
  };
}

/**
 * 简历生成服务：RAG 检索 + ChatDeepSeek + STAR 转化链。
 * 全部核心逻辑封装在此，controller 层只做接口转发。
 */
export const resumeService = {
  async generate(input: ResumeInput): Promise<ResumeGenerationResult> {
    if (!config.deepseek.apiKey) {
      throw new AppError(
        ErrorCode.CONFIG_ERROR,
        500,
        'DEEPSEEK_API_KEY 未配置，无法调用 AI 模型',
      );
    }

    // 1. RAG 双路检索：模板规范 + JD 关键词
    const [templateChunks, jdChunks] = await Promise.all([
      ragService.retrieve(input.targetPosition, {
        categories: ['templates' as KnowledgeCategory, 'hr-standards' as KnowledgeCategory],
      }),
      ragService.retrieve(input.targetPosition, {
        categories: ['job-descriptions' as KnowledgeCategory],
      }),
    ]);

    const references: RetrievedReference[] = [...templateChunks, ...jdChunks].map((chunk) => ({
      category: chunk.metadata.category,
      title: chunk.metadata.title,
      source: chunk.metadata.source,
      score: chunk.score,
      content: chunk.content,
    }));

    // 2. 构建 LLM
    const llmOptions: ConstructorParameters<typeof ChatDeepSeek>[0] = {
      model: config.deepseek.modelName,
      apiKey: config.deepseek.apiKey,
      temperature: 0.3,
      streaming: false,
    };
    if (config.deepseek.baseUrl) {
      // ChatDeepSeek 继承自 ChatOpenAI，支持 configuration.baseURL
      llmOptions.configuration = { baseURL: config.deepseek.baseUrl };
    }
    const llm = new ChatDeepSeek(llmOptions);

    // 3. LCEL 链：prompt | llm | parser
    const prompt = createResumePrompt();
    const parser = new ResumeJsonParser();
    const chain = prompt.pipe(llm).pipe(parser);

    // 4. 调用
    let draft: ResumeDraft;
    try {
      draft = await chain.invoke({
        targetPosition: input.targetPosition,
        templateContext: buildContextText(templateChunks),
        jdContext: buildContextText(jdChunks),
        userInput: buildUserInputJson(input),
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

    // 5. 校验 LLM 回传的经历 id 与输入对应（容错：不匹配时保留原 id）
    const inputIds = new Set(
      [...input.internships, ...input.projects, ...input.clubActivities].map(
        (item) => item.id,
      ),
    );
    const validExperiences = draft.experiences.filter((exp) => inputIds.has(exp.id));
    if (validExperiences.length === 0) {
      throw new AppError(
        ErrorCode.AI_UPSTREAM_ERROR,
        502,
        'AI 输出的经历无法与输入对应，请重试或调整描述',
      );
    }

    // 6. 时间线硬校验（确定性事实，不经过 LLM）
    const timeline = validateTimeline({
      education: input.education,
      internships: input.internships,
      projects: input.projects,
      clubActivities: input.clubActivities,
    });

    // 7. 拼装最终结果
    const resume = assembleResume(input, { ...draft, experiences: validExperiences });
    resume.markdown = renderResumeMarkdown(resume);

    // 8. 内容幻觉校验：用结构化 draft + 原始输入做对比（纯函数，不调 LLM）
    const hallucination = hallucinationService.verify({
      draft: { ...draft, experiences: validExperiences },
      originalInput: input,
    });

    return { resume, references, timeline, hallucination };
  },
};
