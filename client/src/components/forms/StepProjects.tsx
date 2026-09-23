import { useResume } from '../../context/ResumeContext';
import type { RawActivity } from '../../types/resume';

interface StepProjectsProps {
  onBack: () => void;
  onNext: () => void;
}

const emptyProject = (index: number): RawActivity => ({
  id: `p${index + 1}`,
  title: '',
  organization: '',
  role: '',
  startDate: '',
  endDate: '',
  description: '',
});

const StepProjects = ({ onBack, onNext }: StepProjectsProps) => {
  const { form, setForm } = useResume();

  const update = (index: number, field: keyof RawActivity, value: string) => {
    setForm((prev) => {
      const next = [...prev.projects];
      const item = { ...next[index] };
      Object.assign(item, { [field]: value });
      next[index] = item;
      return { ...prev, projects: next };
    });
  };

  const add = () => {
    setForm((prev) => ({
      ...prev,
      projects: [...prev.projects, emptyProject(prev.projects.length)],
    }));
  };

  const remove = (index: number) => {
    setForm((prev) => ({
      ...prev,
      projects: prev.projects.filter((_, i) => i !== index),
    }));
  };

  const valid =
    form.projects.length > 0 &&
    form.projects.every((p) => p.title.trim() && p.description.trim());

  return (
    <div className="step">
      <h2 className="step__title">第 4 步：项目经历</h2>
      <p className="step__hint">
        课程项目、课程作业、个人项目都可以。AI 会基于你给的描述做 STAR 化翻译，描述越具体越好。
      </p>

      {form.projects.map((project, index) => (
        <div key={project.id} className="card">
          <div className="card__head">
            <span>项目 #{index + 1}</span>
            <button type="button" className="btn btn--ghost" onClick={() => remove(index)}>
              删除
            </button>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>项目标题 *</span>
              <input
                type="text"
                value={project.title}
                onChange={(e) => update(index, 'title', e.target.value)}
                placeholder="简历解析器 / 校园二手交易平台"
              />
            </label>
            <label className="field">
              <span>所属组织</span>
              <input
                type="text"
                value={project.organization ?? ''}
                onChange={(e) => update(index, 'organization', e.target.value)}
                placeholder="课程 / 实验室 / 个人"
              />
            </label>
            <label className="field">
              <span>担任角色</span>
              <input
                type="text"
                value={project.role ?? ''}
                onChange={(e) => update(index, 'role', e.target.value)}
                placeholder="主导 / 后端 / 全栈"
              />
            </label>
            <label className="field">
              <span>开始</span>
              <input
                type="month"
                value={project.startDate ?? ''}
                onChange={(e) => update(index, 'startDate', e.target.value)}
              />
            </label>
            <label className="field">
              <span>结束</span>
              <input
                type="month"
                value={project.endDate ?? ''}
                onChange={(e) => update(index, 'endDate', e.target.value)}
              />
            </label>
            <label className="field field--wide">
              <span>口语化描述 *</span>
              <textarea
                value={project.description}
                onChange={(e) => update(index, 'description', e.target.value)}
                rows={4}
                placeholder="做了什么、用了什么技术、解决了什么问题、最后效果。可以写流水账，AI 会职场化翻译。"
              />
            </label>
          </div>
        </div>
      ))}

      <button type="button" className="btn btn--ghost" onClick={add}>
        + 添加项目
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

export default StepProjects;
