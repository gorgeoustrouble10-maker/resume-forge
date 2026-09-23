import { useState } from 'react';
import Stepper from '../components/Stepper';
import StepBasic from '../components/forms/StepBasic';
import StepEducation from '../components/forms/StepEducation';
import StepInternships from '../components/forms/StepInternships';
import StepProjects from '../components/forms/StepProjects';
import StepClubs from '../components/forms/StepClubs';
import StepSkills from '../components/forms/StepSkills';
import { useResume } from '../context/ResumeContext';
import { demoForm } from '../utils/demo-data';

const STEPS = ['基本信息', '教育经历', '实习经历', '项目经历', '社团经历', '技能与提交'];

const FormPage = () => {
  const [step, setStep] = useState(0);
  const { form, setForm, setPage } = useResume();

  const fillDemo = () => {
    const hasContent =
      form.personalInfo.name.trim() !== '' ||
      form.targetPosition.trim() !== '' ||
      form.education.length > 0 ||
      form.internships.length > 0 ||
      form.projects.length > 0 ||
      form.clubActivities.length > 0 ||
      form.skills.length > 0;
    if (hasContent && !window.confirm('示例数据会覆盖当前已填写的内容，确定继续？')) {
      return;
    }
    setForm(() => structuredClone(demoForm));
  };

  return (
    <section className="form-page">
      <div className="form-page__quick">
        <button type="button" className="btn" onClick={fillDemo}>
          一键填充示例数据
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => setPage('upload')}>
          已有简历？直接上传分析
        </button>
      </div>

      <Stepper current={step} steps={STEPS} />

      {step === 0 && <StepBasic onNext={() => setStep(1)} />}
      {step === 1 && (
        <StepEducation onBack={() => setStep(0)} onNext={() => setStep(2)} />
      )}
      {step === 2 && (
        <StepInternships onBack={() => setStep(1)} onNext={() => setStep(3)} />
      )}
      {step === 3 && (
        <StepProjects onBack={() => setStep(2)} onNext={() => setStep(4)} />
      )}
      {step === 4 && (
        <StepClubs
          onBack={() => setStep(3)}
          onNext={() => setStep(5)}
        />
      )}
      {step === 5 && <StepSkills onBack={() => setStep(4)} />}
    </section>
  );
};

export default FormPage;
