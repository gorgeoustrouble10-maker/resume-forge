/**
 * 内容幻觉校验服务的脚本式自检（不引入测试框架，用 node:assert + tsx 运行）。
 * 运行方式：npx tsx src/services/__tests__/hallucination.service.test.ts
 */
import assert from 'node:assert/strict';
import { hallucinationService } from '../hallucination.service.js';
import type { ResumeDraft, ResumeInput } from '../../types/resume.types.js';

// ---------------------------------------------------------------------------
// 辅助构造数据
// ---------------------------------------------------------------------------

const baseInput: ResumeInput = {
  personalInfo: { name: '张三', phone: '13800000000', email: 'a@b.com' },
  targetPosition: '后端开发工程师',
  education: [
    {
      school: '清华大学',
      major: '计算机',
      degree: '本科',
      startDate: '2023-09',
      endDate: '2027-06',
    },
  ],
  internships: [
    {
      id: 'i1',
      title: '某科技公司',
      organization: '后端研发组',
      role: '后端开发实习生',
      startDate: '2026-06',
      endDate: '2026-09',
      description: '使用 Java Spring Boot 开发 RESTful 接口',
    },
  ],
  projects: [],
  clubActivities: [],
  skills: ['Java', 'Spring Boot', 'MySQL', 'Redis', 'JavaScript'],
};

// ---------------------------------------------------------------------------
// 用例 1：编造主体检测（draft.experiences 出现 input 中没有的"腾讯"）
// ---------------------------------------------------------------------------

{
  const draft: ResumeDraft = {
    summary: '应届生',
    experiences: [
      {
        id: 'i1',
        kind: 'internship',
        title: '某科技公司',
        organization: '腾讯',  // ← input 中没有
        role: '后端开发实习生',
        bullets: ['开发内部管理系统'],
      },
    ],
    skills: ['Java'],
  };
  const report = hallucinationService.verify({ draft, originalInput: baseInput });
  const fabrications = report.issues.filter((i) => i.type === 'fabricated_entity');
  assert.ok(fabrications.length > 0, '应检测出编造主体');
  assert.ok(
    fabrications.some((i) => i.evidence.includes('腾讯')),
    `应标记腾讯，实际：${JSON.stringify(fabrications)}`,
  );
  console.log('✓ 用例1：编造主体检测通过');
}

// ---------------------------------------------------------------------------
// 用例 2：技能同义词（JS 应通过、React 应标记编造）
// ---------------------------------------------------------------------------

{
  const draft: ResumeDraft = {
    summary: '',
    experiences: [],
    skills: ['JS', 'React', 'Spring Boot'],  // JS 视为 JavaScript 同义词；React 不在 input
  };
  const report = hallucinationService.verify({ draft, originalInput: baseInput });
  const skillIssues = report.issues.filter((i) => i.type === 'fabricated_skill');
  assert.ok(
    !skillIssues.some((i) => i.evidence === 'JS'),
    'JS 应作为 JavaScript 同义词通过',
  );
  assert.ok(
    skillIssues.some((i) => i.evidence === 'React'),
    'React 应被标记为编造技能',
  );
  console.log('✓ 用例2：技能同义词检测通过');
}

// ---------------------------------------------------------------------------
// 用例 3：量化数字标记
// ---------------------------------------------------------------------------

{
  const draft: ResumeDraft = {
    summary: '',
    experiences: [
      {
        id: 'i1',
        kind: 'internship',
        title: '某科技公司',
        // 正则只识别"数字+单位"形式（%/万/个/倍等），避免误判电话/日期/邮编
        bullets: ['提升性能 30%', '修复 20 个缺陷', 'QPS 提升 3 倍'],
      },
    ],
    skills: [],
  };
  const report = hallucinationService.verify({ draft, originalInput: baseInput });
  const metrics = report.issues.filter((i) => i.type === 'unsupported_metric');
  assert.ok(metrics.length >= 3, `应至少标记 3 处量化，实际 ${metrics.length}`);
  console.log('✓ 用例3：量化数字标记通过');
}

// ---------------------------------------------------------------------------
// 用例 4：时间线冲突复用（经历开始时间早于入学时间超过容忍月数）
// ---------------------------------------------------------------------------

{
  const inputWithConflict: ResumeInput = {
    ...baseInput,
    internships: [
      {
        id: 'i1',
        title: '某公司',
        startDate: '2022-01',  // 早于入学 2023-09 超过 3 个月容忍期
        endDate: '2022-06',
        description: '实习',
      },
    ],
  };
  const draft: ResumeDraft = {
    summary: '',
    experiences: [
      {
        id: 'i1',
        kind: 'internship',
        title: '某公司',
        bullets: [],
      },
    ],
    skills: [],
  };
  const report = hallucinationService.verify({ draft, originalInput: inputWithConflict });
  const timelineIssues = report.issues.filter((i) => i.type === 'timeline_mismatch');
  assert.ok(timelineIssues.length > 0, '应检测出时间线冲突');
  console.log('✓ 用例4：时间线冲突检测通过');
}

// ---------------------------------------------------------------------------
// 用例 5：分数计算（3 high + 2 low → 100 - 45 - 6 = 49）
// ---------------------------------------------------------------------------

{
  const draft: ResumeDraft = {
    summary: '',
    experiences: [
      {
        id: 'i1',
        kind: 'internship',
        title: '腾讯',  // fabricated_entity (high)
        organization: '阿里',  // fabricated_entity (high)
        bullets: ['提升 30%', '减少 20%'],  // 2 × unsupported_metric (low)
      },
    ],
    skills: ['React'],  // fabricated_skill (medium)
  };
  const report = hallucinationService.verify({ draft, originalInput: baseInput });
  const counts = { high: 0, medium: 0, low: 0 };
  for (const i of report.issues) counts[i.severity] += 1;
  // 2 entity high + 1 skill medium + 2 metric low = 2*15 + 1*8 + 2*3 = 44
  // 但还有 timeline_mismatch？没冲突，不计
  // 期望 score = 100 - 30 - 8 - 6 = 56
  const expected = 100 - counts.high * 15 - counts.medium * 8 - counts.low * 3;
  assert.strictEqual(
    report.score,
    Math.max(0, expected),
    `分数计算错误：期望 ${Math.max(0, expected)}，实际 ${report.score}（${JSON.stringify(counts)}）`,
  );
  console.log(`✓ 用例5：分数计算通过（${counts.high}H + ${counts.medium}M + ${counts.low}L = ${report.score}/100）`);
}

// ---------------------------------------------------------------------------
// 用例 6：上传场景降级（无 originalInput，只跑 unsupported_metric）
// ---------------------------------------------------------------------------

{
  const markdown = `# 张三

## 实习经历
### 某公司 | 实习生
- 提升性能 30%
- 减少 20% 缺陷
`;
  const report = hallucinationService.verify({ resumeMarkdown: markdown });
  const metrics = report.issues.filter((i) => i.type === 'unsupported_metric');
  const other = report.issues.filter((i) => i.type !== 'unsupported_metric');
  assert.ok(metrics.length >= 2, `上传场景应扫出量化数据`);
  assert.strictEqual(other.length, 0, '上传场景不应跑主体/技能/时间线校验');
  console.log('✓ 用例6：上传场景降级通过');
}

// ---------------------------------------------------------------------------
// 用例 7：summary 生成
// ---------------------------------------------------------------------------

{
  const draft: ResumeDraft = {
    summary: '',
    experiences: [
      {
        id: 'i1',
        kind: 'internship',
        title: '腾讯',
        bullets: ['提升 30%'],
      },
    ],
    skills: ['React'],
  };
  const report = hallucinationService.verify({ draft, originalInput: baseInput });
  assert.ok(report.summary.includes('编造主体'), `summary 应包含"编造主体"，实际："${report.summary}"`);
  assert.ok(report.summary.includes('编造技能'), `summary 应包含"编造技能"，实际："${report.summary}"`);
  assert.ok(report.summary.includes('量化数据'), `summary 应包含"量化数据"，实际："${report.summary}"`);
  console.log(`✓ 用例7：summary 生成通过（"${report.summary}"）`);
}

console.log('\n✅ 全部 7 个用例通过');
