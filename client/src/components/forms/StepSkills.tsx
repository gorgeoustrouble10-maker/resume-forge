import { useState } from 'react';
import { useResume } from '../../context/ResumeContext';

interface StepSkillsProps {
  onBack: () => void;
}

const StepSkills = ({ onBack }: StepSkillsProps) => {
  const { form, setForm, generateResume, loading } = useResume();
  const [draft, setDraft] = useState('');

  const addSkill = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.includes(trimmed) ? prev.skills : [...prev.skills, trimmed],
    }));
    setDraft('');
  };

  const removeSkill = (skill: string) => {
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== skill),
    }));
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSkill();
    }
  };

  const canSubmit = form.skills.length > 0 && !loading;

  return (
    <div className="step">
      <h2 className="step__title">第 6 步：技能清单与提交</h2>
      <p className="step__hint">
        填写你真实掌握的技能（语言、框架、工具、平台）。AI 会结合目标岗位关键词归并去重后写入简历，不会为你堆砌不会的关键词。
      </p>

      <div className="skills-input">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          placeholder="如：Java、Go、Spring Boot、MySQL、Redis、Docker"
        />
        <button type="button" className="btn btn--ghost" onClick={addSkill} disabled={!draft.trim()}>
          添加
        </button>
      </div>

      <ul className="skills-list">
        {form.skills.map((skill) => (
          <li key={skill} className="skills-list__item">
            <span>{skill}</span>
            <button type="button" className="skills-list__remove" onClick={() => removeSkill(skill)}>
              ×
            </button>
          </li>
        ))}
        {form.skills.length === 0 && (
          <li className="skills-list__empty">还没有添加技能</li>
        )}
      </ul>

      <div className="step__actions">
        <button type="button" className="btn" onClick={onBack} disabled={loading}>
          上一步
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={!canSubmit}
          onClick={() => void generateResume()}
        >
          {loading ? '生成中…' : '生成简历'}
        </button>
      </div>
    </div>
  );
};

export default StepSkills;
