import { AppError, ErrorCode } from './errors.js';
import type {
  EducationRecord,
  PersonalInfo,
  RawActivity,
  ResumeInput,
  TimelineIssue,
  TimelineReport,
} from '../types/resume.types.js';
import type { ScoringInput } from '../types/scoring.types.js';
import type { AtsInput } from '../types/ats.types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, `字段 ${field} 必须是非空字符串`);
  }
  return value.trim();
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, `字段 ${field} 必须是字符串`);
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
}

/** 头像 dataURL 校验：必须是合法 JPEG dataURL，长度上限 280KB（防恶意大字符串） */
function parseAvatar(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, '字段 personalInfo.avatar 必须是字符串');
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  // 前端 Canvas 压缩后形如 data:image/jpeg;base64,/9j/4AAQ...
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(trimmed)) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      400,
      'personalInfo.avatar 必须是 data:image/jpeg;base64,... 形式',
    );
  }
  // 280KB 上限：base64 字符串长度 ≈ 原字节 × 4/3，280KB × 4/3 ≈ 373KB 字符串
  const MAX_AVATAR_LEN = 280 * 1024 * 4 / 3;
  if (trimmed.length > MAX_AVATAR_LEN) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      400,
      'personalInfo.avatar 过大（应 < 280KB），请重新压缩',
    );
  }
  return trimmed;
}

function parsePersonalInfo(value: unknown): PersonalInfo {
  if (!isRecord(value)) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, '缺少 personalInfo 对象');
  }
  return {
    name: requireString(value.name, 'personalInfo.name'),
    phone: requireString(value.phone, 'personalInfo.phone'),
    email: requireString(value.email, 'personalInfo.email'),
    city: optionalString(value.city, 'personalInfo.city'),
    github: optionalString(value.github, 'personalInfo.github'),
    blog: optionalString(value.blog, 'personalInfo.blog'),
    avatar: parseAvatar(value.avatar),
  };
}

function parseEducation(value: unknown): EducationRecord[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'education 至少需要一条教育经历');
  }
  return value.map((item, index) => {
    if (!isRecord(item)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, `education[${index}] 必须是对象`);
    }
    return {
      school: requireString(item.school, `education[${index}].school`),
      major: requireString(item.major, `education[${index}].major`),
      degree: requireString(item.degree, `education[${index}].degree`),
      startDate: requireString(item.startDate, `education[${index}].startDate`),
      endDate: requireString(item.endDate, `education[${index}].endDate`),
      gpa: optionalString(item.gpa, `education[${index}].gpa`),
      rank: optionalString(item.rank, `education[${index}].rank`),
      courses: toStringArray(item.courses, `education[${index}].courses`),
    };
  });
}

/**
 * 解析实习/项目/社团经历。前端未传 id 时按前缀规则补稳定 id（i1、p1、c1），
 * 保证 LLM 回传的经历可以与输入一一对应。
 */
function parseActivities(
  value: unknown,
  field: string,
  idPrefix: 'i' | 'p' | 'c',
): RawActivity[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item, index) => {
    if (!isRecord(item)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, `${field}[${index}] 必须是对象`);
    }
    return {
      id: `${idPrefix}${index + 1}`,
      title: requireString(item.title, `${field}[${index}].title`),
      organization: optionalString(item.organization, `${field}[${index}].organization`),
      role: optionalString(item.role, `${field}[${index}].role`),
      startDate: optionalString(item.startDate, `${field}[${index}].startDate`),
      endDate: optionalString(item.endDate, `${field}[${index}].endDate`),
      description: requireString(item.description, `${field}[${index}].description`),
    };
  });
}

/** 校验并归一化简历生成请求体 */
export function validateResumeInput(body: unknown): ResumeInput {
  if (!isRecord(body)) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, '请求体必须是 JSON 对象');
  }
  const internships = parseActivities(body.internships, 'internships', 'i');
  const projects = parseActivities(body.projects, 'projects', 'p');
  const clubActivities = parseActivities(body.clubActivities, 'clubActivities', 'c');
  if (internships.length === 0 && projects.length === 0 && clubActivities.length === 0) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      400,
      'internships、projects 与 clubActivities 不能同时为空，至少提供一条经历',
    );
  }
  return {
    personalInfo: parsePersonalInfo(body.personalInfo),
    targetPosition: requireString(body.targetPosition, 'targetPosition'),
    education: parseEducation(body.education),
    internships,
    projects,
    clubActivities,
    skills: toStringArray(body.skills, 'skills'),
  };
}

/** 解析前端回传的时间线报告（由本服务生成，仅做轻量结构校验，不合法则忽略） */
function parseTimelineReport(value: unknown): TimelineReport | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value.checkedAt !== 'string' || typeof value.ok !== 'boolean') {
    return undefined;
  }
  const rawIssues = Array.isArray(value.issues) ? value.issues : [];
  const issues: TimelineIssue[] = [];
  for (const item of rawIssues) {
    if (
      isRecord(item) &&
      typeof item.kind === 'string' &&
      typeof item.location === 'string' &&
      typeof item.message === 'string'
    ) {
      issues.push({
        kind: item.kind as TimelineIssue['kind'],
        location: item.location,
        message: item.message,
      });
    }
  }
  return { checkedAt: value.checkedAt, ok: value.ok, issues };
}

/** 校验并归一化 HR 评分请求体 */
export function validateScoringInput(body: unknown): ScoringInput {
  if (!isRecord(body)) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, '请求体必须是 JSON 对象');
  }
  return {
    targetPosition: requireString(body.targetPosition, 'targetPosition'),
    resumeMarkdown: requireString(body.resumeMarkdown, 'resumeMarkdown'),
    timelineReport: parseTimelineReport(body.timelineReport),
  };
}

/** 校验并归一化 ATS 检测请求体 */
export function validateAtsInput(body: unknown): AtsInput {
  if (!isRecord(body)) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, '请求体必须是 JSON 对象');
  }
  return {
    targetPosition: requireString(body.targetPosition, 'targetPosition'),
    resumeMarkdown: requireString(body.resumeMarkdown, 'resumeMarkdown'),
  };
}

/**
 * 校验并归一化幻觉校验请求体。
 * - 生成场景：传 resumeMarkdown + originalInput，跑全部 4 类校验。
 * - 上传场景：只传 resumeMarkdown，降级只跑 unsupported_metric。
 */
export function validateHallucinationInput(body: unknown): {
  resumeMarkdown: string;
  originalInput?: ResumeInput;
} {
  if (!isRecord(body)) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, '请求体必须是 JSON 对象');
  }
  const resumeMarkdown = requireString(body.resumeMarkdown, 'resumeMarkdown');
  // originalInput 是可选的；若提供则按完整 ResumeInput 校验（但允许 personalInfo 缺字段降级）
  if (body.originalInput === undefined || body.originalInput === null) {
    return { resumeMarkdown };
  }
  // 复用现有 validateResumeInput 完成严格校验
  const originalInput = validateResumeInput(body.originalInput);
  return { resumeMarkdown, originalInput };
}
