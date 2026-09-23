import { useState } from 'react';
import type { GeneratedResume } from '../types/resume';

interface ResumePreviewProps {
  resume: GeneratedResume;
}

const experienceGroups = [
  { heading: '实习经历', kind: 'internship' as const },
  { heading: '项目经历', kind: 'project' as const },
  { heading: '校园经历', kind: 'club' as const },
];

/** 简历模板预览；两个视图常驻 DOM 由 CSS 切换显示，保证打印始终输出结构化模板 */
const ResumePreview = ({ resume }: ResumePreviewProps) => {
  const [view, setView] = useState<'structured' | 'markdown'>('structured');

  const contacts = [
    resume.personalInfo.phone,
    resume.personalInfo.email,
    resume.personalInfo.city,
    resume.personalInfo.github,
    resume.personalInfo.blog,
  ].filter((value): value is string => Boolean(value && value.trim()));

  return (
    <div className="resume-preview">
      <div className="resume-preview__tabs">
        <button
          type="button"
          className={`tab ${view === 'structured' ? 'tab--active' : ''}`}
          onClick={() => setView('structured')}
        >
          结构化预览
        </button>
        <button
          type="button"
          className={`tab ${view === 'markdown' ? 'tab--active' : ''}`}
          onClick={() => setView('markdown')}
        >
          Markdown 原文
        </button>
      </div>

      <article className={`resume-doc ${view === 'markdown' ? 'resume-doc--hidden' : ''}`}>
        <header className="resume-doc__header">
          <h1>{resume.personalInfo.name}</h1>
          <p className="resume-doc__intent">求职意向：{resume.targetPosition}</p>
          {contacts.length > 0 && (
            <p className="resume-doc__contacts">
              {contacts.map((contact, i) => (
                <span key={i} className="resume-doc__contact">
                  {contact}
                </span>
              ))}
            </p>
          )}
        </header>

        <section className="resume-doc__section">
          <h2>个人优势</h2>
          <p className="resume-doc__summary">{resume.summary}</p>
        </section>

        {resume.education.length > 0 && (
          <section className="resume-doc__section">
            <h2>教育经历</h2>
            {resume.education.map((edu, i) => {
              const subParts = [edu.major, edu.degree].filter(Boolean);
              const extraParts = [
                edu.gpa ? `GPA ${edu.gpa}` : '',
                edu.rank ? `排名 ${edu.rank}` : '',
              ].filter(Boolean);
              return (
                <div key={i} className="resume-doc__entry">
                  <div className="resume-doc__entry-head">
                    <h3 className="resume-doc__entry-title">{edu.school}</h3>
                    {edu.period && (
                      <span className="resume-doc__entry-period">{edu.period}</span>
                    )}
                  </div>
                  {subParts.length > 0 && (
                    <p className="resume-doc__entry-sub">{subParts.join(' · ')}</p>
                  )}
                  {extraParts.length > 0 && (
                    <p className="resume-doc__entry-note">{extraParts.join(' · ')}</p>
                  )}
                  {edu.courses && edu.courses.length > 0 && (
                    <p className="resume-doc__entry-note">主修课程：{edu.courses.join('、')}</p>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {experienceGroups.map((group) => {
          const items = resume.experiences.filter((exp) => exp.kind === group.kind);
          if (items.length === 0) return null;
          return (
            <section key={group.kind} className="resume-doc__section">
              <h2>{group.heading}</h2>
              {items.map((exp) => {
                const subParts = [exp.organization, exp.role].filter(Boolean);
                return (
                  <div key={exp.id} className="resume-doc__entry">
                    <div className="resume-doc__entry-head">
                      <h3 className="resume-doc__entry-title">{exp.title}</h3>
                      {exp.period && (
                        <span className="resume-doc__entry-period">{exp.period}</span>
                      )}
                    </div>
                    {subParts.length > 0 && (
                      <p className="resume-doc__entry-sub">{subParts.join(' · ')}</p>
                    )}
                    {exp.bullets.length > 0 && (
                      <ul className="resume-doc__bullets">
                        {exp.bullets.map((bullet, i) => (
                          <li key={i}>{bullet}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </section>
          );
        })}

        {resume.skills.length > 0 && (
          <section className="resume-doc__section">
            <h2>技能清单</h2>
            <ul className="resume-doc__skills">
              {resume.skills.map((skill) => (
                <li key={skill}>{skill}</li>
              ))}
            </ul>
          </section>
        )}
      </article>

      <pre
        className={`resume-doc__markdown ${
          view === 'markdown' ? '' : 'resume-doc__markdown--hidden'
        }`}
      >
        {resume.markdown}
      </pre>
    </div>
  );
};

export default ResumePreview;
