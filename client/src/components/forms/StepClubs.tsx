import { useResume } from '../../context/ResumeContext';
import type { RawActivity } from '../../types/resume';

interface StepClubsProps {
  onBack: () => void;
  onNext: () => void;
}

const emptyClub = (index: number): RawActivity => ({
  id: `c${index + 1}`,
  title: '',
  organization: '',
  role: '',
  startDate: '',
  endDate: '',
  description: '',
});

const StepClubs = ({ onBack, onNext }: StepClubsProps) => {
  const { form, setForm } = useResume();

  const update = (index: number, field: keyof RawActivity, value: string) => {
    setForm((prev) => {
      const next = [...prev.clubActivities];
      const item = { ...next[index] };
      Object.assign(item, { [field]: value });
      next[index] = item;
      return { ...prev, clubActivities: next };
    });
  };

  const add = () => {
    setForm((prev) => ({
      ...prev,
      clubActivities: [...prev.clubActivities, emptyClub(prev.clubActivities.length)],
    }));
  };

  const remove = (index: number) => {
    setForm((prev) => ({
      ...prev,
      clubActivities: prev.clubActivities.filter((_, i) => i !== index),
    }));
  };

  const valid =
    form.clubActivities.length > 0 &&
    form.clubActivities.every((c) => c.title.trim() && c.description.trim());

  return (
    <div className="step">
      <h2 className="step__title">第 5 步：社团经历</h2>
      <p className="step__hint">
        学生会、社团、志愿者、竞赛队伍等都算。如果完全没有社团经历，可以跳过（直接下一步），但建议至少填一条。
      </p>

      {form.clubActivities.map((club, index) => (
        <div key={club.id} className="card">
          <div className="card__head">
            <span>社团 #{index + 1}</span>
            <button type="button" className="btn btn--ghost" onClick={() => remove(index)}>
              删除
            </button>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>活动标题 *</span>
              <input
                type="text"
                value={club.title}
                onChange={(e) => update(index, 'title', e.target.value)}
                placeholder="校技术协会负责人 / 学生会外联部干事"
              />
            </label>
            <label className="field">
              <span>所属组织</span>
              <input
                type="text"
                value={club.organization ?? ''}
                onChange={(e) => update(index, 'organization', e.target.value)}
                placeholder="校学生会 / 计算机协会"
              />
            </label>
            <label className="field">
              <span>担任角色</span>
              <input
                type="text"
                value={club.role ?? ''}
                onChange={(e) => update(index, 'role', e.target.value)}
                placeholder="部长 / 干事 / 队长"
              />
            </label>
            <label className="field">
              <span>开始</span>
              <input
                type="month"
                value={club.startDate ?? ''}
                onChange={(e) => update(index, 'startDate', e.target.value)}
              />
            </label>
            <label className="field">
              <span>结束</span>
              <input
                type="month"
                value={club.endDate ?? ''}
                onChange={(e) => update(index, 'endDate', e.target.value)}
              />
            </label>
            <label className="field field--wide">
              <span>口语化描述 *</span>
              <textarea
                value={club.description}
                onChange={(e) => update(index, 'description', e.target.value)}
                rows={4}
                placeholder="做了什么、组织了多少人、办了什么活动、取得什么效果。AI 会翻译成通用职场能力。"
              />
            </label>
          </div>
        </div>
      ))}

      <button type="button" className="btn btn--ghost" onClick={add}>
        + 添加社团经历
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

export default StepClubs;
