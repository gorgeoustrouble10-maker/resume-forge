import type { FormState } from '../context/ResumeContext';

/** 一键填充的完整示例数据：用于快速走通「填写 → 生成 → 评分/ATS」全流程 */
export const demoForm: FormState = {
  personalInfo: {
    name: '张三',
    phone: '13800138000',
    email: 'zhangsan@example.com',
    city: '北京',
    github: 'github.com/zhangsan',
  },
  targetPosition: '后端开发工程师',
  education: [
    {
      school: '清华大学',
      major: '计算机科学与技术',
      degree: '本科',
      startDate: '2023-09',
      endDate: '2027-06',
      gpa: '3.8/4.0',
      rank: '前10%',
      courses: ['数据结构', '操作系统', '计算机网络', '数据库原理'],
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
      description:
        '参与公司内部管理系统的后端开发，用 Java 和 Spring Boot 独立完成 12 个 RESTful 接口，接口平均响应时间从 400ms 优化到 150ms；修复 20+ 个线上缺陷，参加 8 次代码评审。',
    },
  ],
  projects: [
    {
      id: 'p1',
      title: 'AI 简历助手',
      organization: '个人项目',
      role: '全栈开发',
      startDate: '2026-03',
      endDate: '2026-06',
      description:
        '做了一个 AI 简历生成工具，分步表单收集信息，调用大模型把口语化经历改写成 STAR 结构，用 LangChain 和 Chroma 搭了 RAG 知识库做 HR 评分和 ATS 检测，前端用 React + TypeScript，后端用 Node.js 和 Express。上线后帮 30 多个同学生成了简历，生成时间从 10 分钟缩短到 1 分钟。',
    },
  ],
  clubActivities: [
    {
      id: 'c1',
      title: '校庆志愿者',
      organization: '校学生会',
      role: '志愿者组长',
      startDate: '2025-09',
      endDate: '2025-09',
      description:
        '组织校庆志愿活动，招募并培训了 30 名志愿者，负责接待引导，服务来宾 2000+ 人次，活动满意度调查 95%。',
    },
  ],
  skills: [
    'Java',
    'Spring Boot',
    'MySQL',
    'Redis',
    'Docker',
    'Node.js',
    'Express',
    'RESTful API',
    'Git',
    'Linux',
  ],
};
