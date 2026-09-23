import { useResume } from '../../context/ResumeContext';
import type { EducationRecord } from '../../types/resume';

interface StepEducationProps {
  onBack: () => void;
  onNext: () => void;
}

const emptyEducation = (): EducationRecord => ({
  school: '',
  major: '',
  degree: '本科',
  startDate: '',
  endDate: '',
});

const StepEducation = ({ onBack, onNext }: StepEducationProps) => {
  const { form, setForm } = useResume();

  const update = (index: number, field: keyof EducationRecord, value: string) => {
    setForm((prev) => {
      const next = [...prev.education];
      const item = { ...next[index] };
      if (field === 'courses') {
        item.courses = value
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
      } else {
        // 其余字段都是 string，用 Object.assign 避开 union field 写入的类型校验
        Object.assign(item, { [field]: value });
      }
      next[index] = item;
      return { ...prev, education: next };
    });
  };

  const add = () => {
    setForm((prev) => ({
      ...prev,
      education: [...prev.education, emptyEducation()],
    }));
  };

  const remove = (index: number) => {
    setForm((prev) => ({
      ...prev,
      education: prev.education.filter((_, i) => i !== index),
    }));
  };

  const valid =
    form.education.length > 0 &&
    form.education.every(
      (e) => e.school.trim() && e.major.trim() && e.degree.trim() && e.startDate && e.endDate,
    );

  return (
    <div className="step">
      <h2 className="step__title">第 2 步：教育经历</h2>
      <p className="step__hint">至少填写一条教育经历。GPA、排名、相关课程可选。</p>

      {form.education.map((edu, index) => (
        <div key={index} className="card">
          <div className="card__head">
            <span>教育 #{index + 1}</span>
            <button type="button" className="btn btn--ghost" onClick={() => remove(index)}>
              删除
            </button>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>学校 *</span>
              <input
                type="text"
                value={edu.school}
                onChange={(e) => update(index, 'school', e.target.value)}
                placeholder="XX大学"
              />
            </label>
            <label className="field">
              <span>专业 *</span>
              <input
                type="text"
                value={edu.major}
                onChange={(e) => update(index, 'major', e.target.value)}
                placeholder="计算机科学与技术"
              />
            </label>
            <label className="field">
              <span>学历 *</span>
              <select
                value={edu.degree}
                onChange={(e) => update(index, 'degree', e.target.value)}
              >
                <option value="大专">大专</option>
                <option value="本科">本科</option>
                <option value="硕士">硕士</option>
                <option value="博士">博士</option>
              </select>
            </label>
            <label className="field">
              <span>开始 *</span>
              <input
                type="month"
                value={edu.startDate}
                onChange={(e) => update(index, 'startDate', e.target.value)}
              />
            </label>
            <label className="field">
              <span>结束 *</span>
              <input
                type="month"
                value={edu.endDate}
                onChange={(e) => update(index, 'endDate', e.target.value)}
              />
            </label>
            <label className="field">
              <span>GPA</span>
              <input
                type="text"
                value={edu.gpa ?? ''}
                onChange={(e) => update(index, 'gpa', e.target.value)}
                placeholder="3.8/4.0"
              />
            </label>
            <label className="field">
              <span>排名</span>
              <input
                type="text"
                value={edu.rank ?? ''}
                onChange={(e) => update(index, 'rank', e.target.value)}
                placeholder="前 10%"
              />
            </label>
            <label className="field field--wide">
              <span>相关课程（用逗号分隔）</span>
              <input
                type="text"
                value={edu.courses?.join(', ') ?? ''}
                onChange={(e) =>
                  update(
                    index,
                    'courses',
                    e.target.value,
                  )
                }
                placeholder="数据结构, 操作系统, 计算机网络"
              />
            </label>
          </div>
        </div>
      ))}

      <button type="button" className="btn btn--ghost" onClick={add}>
        + 添加教育经历
      </button>

      <div className="step__actions">
        <button type="button" className="btn" onClick={onBack}>
          上一步
        </button>
        <button type="button" className="btn btn--primary" disabled={!valid} onClick={onNext}>
          下一步
        </button>
      </div>
    </div>
  );
};

export default StepEducation;
