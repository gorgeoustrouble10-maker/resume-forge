import type {
  GeneratedResume,
  ProfessionalExperience,
  ResumeEducationView,
} from '../types/resume.types.js';

function formatPeriod(start?: string, end?: string): string | undefined {
  if (!start && !end) return undefined;
  return [start, end].filter((value) => value).join(' - ');
}

function formatEducation(education: {
  school: string;
  major: string;
  degree: string;
  startDate: string;
  endDate: string;
  gpa?: string;
  rank?: string;
  courses?: string[];
}[]): ResumeEducationView[] {
  return education.map((item) => ({
    school: item.school,
    major: item.major,
    degree: item.degree,
    period: formatPeriod(item.startDate, item.endDate) ?? '',
    gpa: item.gpa,
    rank: item.rank,
    courses: item.courses,
  }));
}

function formatExperience(exp: ProfessionalExperience): string {
  const lines: string[] = [];
  const header = [exp.title, exp.organization, exp.role, exp.period]
    .filter((value) => value && value.trim().length > 0)
    .join(' | ');
  lines.push(`### ${header}`);
  for (const bullet of exp.bullets) {
    lines.push(`- ${bullet}`);
  }
  return lines.join('\n');
}

/** 将结构化简历渲染为可导出的 markdown 全文 */
export function renderResumeMarkdown(resume: {
  targetPosition: string;
  personalInfo: GeneratedResume['personalInfo'];
  summary: string;
  education: ResumeEducationView[];
  experiences: ProfessionalExperience[];
  skills: string[];
}): string {
  const { personalInfo, summary, education, experiences, skills } = resume;
  const sections: string[] = [];

  // 标题与联系方式
  sections.push(`# ${personalInfo.name}`);
  // 头像（前端 Canvas 压缩后的 JPEG dataURL）：居中插入，未上传则跳过
  if (personalInfo.avatar && personalInfo.avatar.trim().length > 0) {
    sections.push('');
    sections.push(`<div align="center"><img src="${personalInfo.avatar}" alt="头像" width="120" height="120" style="border-radius:50%" /></div>`);
    sections.push('');
  }
  const contacts = [
    personalInfo.phone,
    personalInfo.email,
    personalInfo.city,
    personalInfo.github,
    personalInfo.blog,
  ].filter((value) => value && value.trim().length > 0);
  if (contacts.length > 0) {
    sections.push(contacts.join(' | '));
  }
  sections.push('');

  // 求职意向
  sections.push(`## 求职意向`);
  sections.push(resume.targetPosition);
  sections.push('');

  // 个人优势
  sections.push('## 个人优势');
  sections.push(summary);
  sections.push('');

  // 教育经历
  if (education.length > 0) {
    sections.push('## 教育经历');
    for (const item of education) {
      const header = [item.school, item.major, item.degree, item.period]
        .filter((value) => value && value.trim().length > 0)
        .join(' | ');
      sections.push(`### ${header}`);
      const extras: string[] = [];
      if (item.gpa) extras.push(`GPA: ${item.gpa}`);
      if (item.rank) extras.push(`排名: ${item.rank}`);
      if (extras.length > 0) sections.push(extras.join(' | '));
      if (item.courses && item.courses.length > 0) {
        sections.push(`相关课程: ${item.courses.join('、')}`);
      }
      sections.push('');
    }
  }

  // 经历按板块分组：实习（HR 权重最高）→ 项目 → 校园经历
  const experienceGroups: { heading: string; kind: ProfessionalExperience['kind'] }[] = [
    { heading: '实习经历', kind: 'internship' },
    { heading: '项目经历', kind: 'project' },
    { heading: '校园经历', kind: 'club' },
  ];
  for (const group of experienceGroups) {
    const groupItems = experiences.filter((exp) => exp.kind === group.kind);
    if (groupItems.length === 0) continue;
    sections.push(`## ${group.heading}`);
    for (const exp of groupItems) {
      sections.push(formatExperience(exp));
      sections.push('');
    }
  }

  // 技能
  if (skills.length > 0) {
    sections.push('## 技能清单');
    sections.push(skills.map((skill) => `- ${skill}`).join('\n'));
    sections.push('');
  }

  return sections.join('\n').trim() + '\n';
}

/** 构建最终结果时把教育经历转成视图 */
export function buildEducationView(education: {
  school: string;
  major: string;
  degree: string;
  startDate: string;
  endDate: string;
  gpa?: string;
  rank?: string;
  courses?: string[];
}[]): ResumeEducationView[] {
  return formatEducation(education);
}
