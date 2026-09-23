import { useResume } from '../../context/ResumeContext';
import type { RawActivity } from '../../types/resume';

interface StepInternshipsProps {
  onBack: () => void;
  onNext: () => void;
}

const emptyInternship = (index: number): RawActivity => ({
  id: `i${index + 1}`,
  title: '',
  organization: '',
  role: '',
  startDate: '',
  endDate: '',
  description: '',
});

const StepInternships = ({ onBack, onNext }: StepInternshipsProps) => {
  const { form, setForm } = useResume();

  const update = (index: number, field: keyof RawActivity, value: string) => {
    setForm((prev) => {
      const next = [...prev.internships];
      const item = { ...next[index] };
      Object.assign(item, { [field]: value });
      next[index] = item;
      return { ...prev, internships: next };
    });
  };

  const add = () => {
    setForm((prev) => ({
      ...prev,
      internships: [...prev.internships, emptyInternship(prev.internships.length)],
    }));
  };

  const remove = (index: number) => {
    setForm((prev) => ({
      ...prev,
      internships: prev.internships.filter((_, i) => i !== index),
    }));
  };

  // 实习经历允许为空（应届生可能尚无实习）；有条目时每条必须有标题与描述
  const valid =
    form.internships.length === 0 ||
    form.internships.every((item) => item.title.trim() && item.description.trim());

  return (
    <div className="step">
      <h2 className="step__title">第 3 步：实习经历</h2>
      <p className="step__hint">
        正式实习、日常实习都可以，实习经历是 HR 最看重的板块。如果还没有实习经历，可以直接跳过这一步。
      </p>

      {form.internships.map((internship, index) => (
        <div key={internship.id} className="card">
          <div className="card__head">
            <span>实习 #{index + 1}</span>
            <button type="button" className="btn btn--ghost" onClick={() => remove(index)}>
              删除
            </button>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>公司/团队 *</span>
              <input
                type="text"
                value={internship.title}
                onChange={(e) => update(index, 'title', e.target.value)}
                placeholder="XX 科技有限公司 / XX 实验室团队"
              />
            </label>
            <label className="field">
              <span>所属部门</span>
              <input
                type="text"
                value={internship.organization ?? ''}
                onChange={(e) => update(index, 'organization', e.target.value)}
                placeholder="后端研发组 / 基础架构部"
              />
            </label>
            <label className="field">
              <span>担任岗位</span>
              <input
                type="text"
                value={internship.role ?? ''}
                onChange={(e) => update(index, 'role', e.target.value)}
                placeholder="后端开发实习生"
              />
            </label>
            <label className="field">
              <span>开始</span>
              <input
                type="month"
                value={internship.startDate ?? ''}
                onChange={(e) => update(index, 'startDate', e.target.value)}
              />
            </label>
            <label className="field">
              <span>结束</span>
              <input
                type="month"
                value={internship.endDate ?? ''}
                onChange={(e) => update(index, 'endDate', e.target.value)}
              />
            </label>
            <label className="field field--wide">
              <span>口语化描述 *</span>
              <textarea
                value={internship.description}
                onChange={(e) => update(index, 'description', e.target.value)}
                rows={4}
                placeholder="业务背景是什么、你负责了什么、用了什么技术、解决了什么问题、产出与效果（有数字尽量写数字）。AI 会职场化翻译。"
              />
            </label>
          </div>
        </div>
      ))}

      <button type="button" className="btn btn--ghost" onClick={add}>
        + 添加实习经历
      </button>

      <div className="step__actions">
        <button type="button" className="btn" onClick={onBack}>
          上一步
        </button>
        <button type="button" className="btn btn--primary" disabled={!valid} onClick={onNext}>
          {form.internships.length === 0 ? '跳过，下一步' : '下一步'}
        </button>
      </div>
    </div>
  );
};

export default StepInternships;
