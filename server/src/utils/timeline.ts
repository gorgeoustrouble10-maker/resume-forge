import type {
  EducationRecord,
  RawActivity,
  TimelineEntryKind,
  TimelineIssue,
  TimelineReport,
} from '../types/resume.types.js';

/** 时间线校验的输入：简历生成前的全部结构化时间信息 */
export interface TimelineInput {
  education: EducationRecord[];
  internships: RawActivity[];
  projects: RawActivity[];
  clubActivities: RawActivity[];
}

/** 绝对月份数（year * 12 + month），用于精确比较，杜绝字符串/幻觉比较 */
interface YearMonth {
  value: number;
  label: string;
}

/** 容忍月数：入学前 3 个月内的经历视为正常（入学前暑假等） */
const BEFORE_EDUCATION_TOLERANCE_MONTHS = 3;
/** 容忍月数：经历开始时间最多领先当前 6 个月（已确定的未来实习可接受） */
const FUTURE_TOLERANCE_MONTHS = 6;
/** 容忍月数：经历结束时间晚于「毕业时间 / 当前时间」中较晚者 12 个月内视为正常 */
const AFTER_EDUCATION_TOLERANCE_MONTHS = 12;

/** 解析 YYYY-MM（前端 month input 的标准格式），非法或缺失返回 null */
function parseYearMonth(raw?: string): YearMonth | null {
  if (!raw || !raw.trim()) return null;
  const text = raw.trim();
  const matched = /^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/.exec(text);
  if (!matched) return null;
  const year = Number(matched[1]);
  const month = Number(matched[2]);
  if (month < 1 || month > 12) return null;
  return { value: year * 12 + month - 1, label: text.slice(0, 7) };
}

const KIND_LABEL: Record<TimelineEntryKind, string> = {
  education: '教育经历',
  internship: '实习经历',
  project: '项目经历',
  club: '社团经历',
};

interface ActivityRef {
  kind: Exclude<TimelineEntryKind, 'education'>;
  activity: RawActivity;
  index: number;
}

/**
 * 时间线硬校验：所有日期先后关系由代码精确比较。
 * 合法情形（不产 issue）：
 * - 在读期间（含毕业前）的实习/项目/社团；
 * - 毕业 gap 期内（毕业至当前）的经历；
 * - 入学前 3 个月内的经历（入学前暑假）；
 * - 已确定的 6 个月内未来实习。
 */
export function validateTimeline(
  input: TimelineInput,
  now: Date = new Date(),
): TimelineReport {
  const issues: TimelineIssue[] = [];
  const nowYm = now.getFullYear() * 12 + now.getMonth();

  // 1. 教育经历自身起止校验 + 求教育时间并集
  let eduMin: number | null = null;
  let eduMax: number | null = null;
  input.education.forEach((edu, index) => {
    const start = parseYearMonth(edu.startDate);
    const end = parseYearMonth(edu.endDate);
    if (start && end && start.value > end.value) {
      issues.push({
        kind: 'education',
        location: `${KIND_LABEL.education} #${index + 1}（${edu.school}）`,
        message: `开始时间（${start.label}）晚于结束时间（${end.label}），起止时间倒置`,
      });
    }
    if (start) eduMin = eduMin === null ? start.value : Math.min(eduMin, start.value);
    if (end) eduMax = eduMax === null ? end.value : Math.max(eduMax, end.value);
  });

  // 2. 各类经历逐条校验
  const refs: ActivityRef[] = [
    ...input.internships.map((activity, index) => ({ kind: 'internship' as const, activity, index })),
    ...input.projects.map((activity, index) => ({ kind: 'project' as const, activity, index })),
    ...input.clubActivities.map((activity, index) => ({ kind: 'club' as const, activity, index })),
  ];

  // 经历结束时间的合法上限：毕业 / 当前 中较晚者 + 12 个月缓冲
  const endUpperBound =
    Math.max(nowYm, eduMax ?? nowYm) + AFTER_EDUCATION_TOLERANCE_MONTHS;

  for (const ref of refs) {
    const { kind, activity, index } = ref;
    const start = parseYearMonth(activity.startDate);
    const end = parseYearMonth(activity.endDate);
    const title = activity.title.trim() || `#${index + 1}`;
    const location = `${KIND_LABEL[kind]} - ${title}`;

    // 日期缺失或非法：交给表单层提示，时间线不臆断
    if (!start && !end) continue;

    if (start && end && start.value > end.value) {
      issues.push({
        kind,
        location,
        message: `开始时间（${start.label}）晚于结束时间（${end.label}），起止时间倒置`,
      });
      continue;
    }

    if (start && eduMin !== null && start.value < eduMin - BEFORE_EDUCATION_TOLERANCE_MONTHS) {
      issues.push({
        kind,
        location,
        message: `开始时间（${start.label}）早于入学时间（${formatYm(eduMin)}）超过 ${BEFORE_EDUCATION_TOLERANCE_MONTHS} 个月，请核对`,
      });
    }

    if (start && start.value > nowYm + FUTURE_TOLERANCE_MONTHS) {
      issues.push({
        kind,
        location,
        message: `开始时间（${start.label}）距当前过远（超过 ${FUTURE_TOLERANCE_MONTHS} 个月），未发生的经历不应写入简历`,
      });
    }

    if (end && end.value > endUpperBound) {
      issues.push({
        kind,
        location,
        message: `结束时间（${end.label}）晚于「毕业时间 / 当前时间」超过 ${AFTER_EDUCATION_TOLERANCE_MONTHS} 个月，请核对`,
      });
    }
  }

  return {
    checkedAt: now.toISOString(),
    ok: issues.length === 0,
    issues,
  };
}

function formatYm(value: number): string {
  const year = Math.floor(value / 12);
  const month = (value % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * 把时间线报告渲染为注入评分 prompt 的「既定事实」文本。
 * 明确告知 LLM 日期比较已由代码完成，禁止重新推断。
 */
export function renderTimelineFacts(report: TimelineReport | undefined): string {
  if (!report) {
    return '（未提供系统时间线校验结果，不得臆测任何日期矛盾，不要输出时间线类判断）';
  }
  const checkedLabel = report.checkedAt.slice(0, 10);
  if (report.ok) {
    return [
      `当前日期：${checkedLabel}（系统时间锚点）。`,
      '系统已基于 YYYY-MM 精确比较完成时间线硬校验：全部教育/实习/项目/社团经历的起止时间均无矛盾。',
      '在读期间（含毕业前）进行的实习、项目与社团活动属于正常情况。',
      '你必须直接采信该结论：禁止重新比较日期、禁止报告任何时间线矛盾类问题。',
    ].join('\n');
  }
  const lines = report.issues.map(
    (issue, index) => `${index + 1}. [${issue.location}] ${issue.message}`,
  );
  return [
    `当前日期：${checkedLabel}（系统时间锚点）。`,
    '系统已基于 YYYY-MM 精确比较完成时间线硬校验，发现以下且仅以下时间线问题：',
    ...lines,
    '你只能围绕上述问题给出时间线相关建议，禁止新增任何其他日期判断，禁止报告未列出的时间线矛盾。',
  ].join('\n');
}
