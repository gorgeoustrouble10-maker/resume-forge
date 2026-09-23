import { useState, type ChangeEvent } from 'react';
import { useResume } from '../../context/ResumeContext';
import { compressAvatar, formatBytes } from '../../utils/image-compress';

interface StepBasicProps {
  onNext: () => void;
}

const StepBasic = ({ onNext }: StepBasicProps) => {
  const { form, setForm } = useResume();
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarSize, setAvatarSize] = useState<number | null>(null);

  const update = (field: keyof typeof form.personalInfo, value: string) => {
    setForm((prev) => ({
      ...prev,
      personalInfo: { ...prev.personalInfo, [field]: value },
    }));
  };

  const onAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setAvatarError(null);
    if (!file) return;
    setAvatarBusy(true);
    try {
      const { dataUrl, sizeBytes } = await compressAvatar(file);
      setForm((prev) => ({
        ...prev,
        personalInfo: { ...prev.personalInfo, avatar: dataUrl },
      }));
      setAvatarSize(sizeBytes);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : '图片压缩失败');
      setAvatarSize(null);
    } finally {
      setAvatarBusy(false);
      // 清空 input.value，允许同一文件再次触发 onChange（先选错再选对的场景）
      event.target.value = '';
    }
  };

  const removeAvatar = () => {
    setForm((prev) => {
      const next = { ...prev, personalInfo: { ...prev.personalInfo } };
      delete next.personalInfo.avatar;
      return next;
    });
    setAvatarSize(null);
    setAvatarError(null);
  };

  const valid =
    form.personalInfo.name.trim() &&
    form.personalInfo.phone.trim() &&
    form.personalInfo.email.trim() &&
    form.targetPosition.trim();

  return (
    <div className="step">
      <h2 className="step__title">第 1 步：基本信息与目标岗位</h2>
      <p className="step__hint">填写真实联系方式与目标岗位，HR 会据此筛选。</p>

      <div className="form-grid">
        <label className="field">
          <span>姓名 *</span>
          <input
            type="text"
            value={form.personalInfo.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="张三"
          />
        </label>
        <label className="field">
          <span>电话 *</span>
          <input
            type="tel"
            value={form.personalInfo.phone}
            onChange={(e) => update('phone', e.target.value)}
            placeholder="13800000000"
          />
        </label>
        <label className="field">
          <span>邮箱 *</span>
          <input
            type="email"
            value={form.personalInfo.email}
            onChange={(e) => update('email', e.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <label className="field">
          <span>城市</span>
          <input
            type="text"
            value={form.personalInfo.city ?? ''}
            onChange={(e) => update('city', e.target.value)}
            placeholder="北京"
          />
        </label>
        <label className="field">
          <span>GitHub</span>
          <input
            type="text"
            value={form.personalInfo.github ?? ''}
            onChange={(e) => update('github', e.target.value)}
            placeholder="github.com/yourname"
          />
        </label>
        <label className="field">
          <span>博客</span>
          <input
            type="text"
            value={form.personalInfo.blog ?? ''}
            onChange={(e) => update('blog', e.target.value)}
            placeholder="可选"
          />
        </label>
        <label className="field field--wide">
          <span>目标岗位 *</span>
          <input
            type="text"
            value={form.targetPosition}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, targetPosition: e.target.value }))
            }
            placeholder="后端开发工程师 / 前端开发工程师 / 算法工程师"
          />
        </label>
        <div className="field field--wide field--avatar">
          <span>头像（可选，自动压缩）</span>
          <div className="avatar-uploader">
            {form.personalInfo.avatar ? (
              <img
                src={form.personalInfo.avatar}
                alt="头像预览"
                className="avatar-uploader__preview"
              />
            ) : (
              <div className="avatar-uploader__placeholder">无</div>
            )}
            <div className="avatar-uploader__actions">
              <label className="btn btn--ghost">
                {avatarBusy ? '压缩中…' : form.personalInfo.avatar ? '更换' : '上传'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => void onAvatarChange(e)}
                  disabled={avatarBusy}
                  style={{ display: 'none' }}
                />
              </label>
              {form.personalInfo.avatar && (
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={removeAvatar}
                  disabled={avatarBusy}
                >
                  移除
                </button>
              )}
              {avatarSize && !avatarBusy && (
                <span className="avatar-uploader__size">
                  已压缩 {formatBytes(avatarSize)}
                </span>
              )}
              {avatarError && (
                <span className="avatar-uploader__error">{avatarError}</span>
              )}
            </div>
          </div>
          <p className="field__hint">
            客户端 Canvas 压缩到长边 400px / JPEG 0.85 / &lt; 200KB，文件不上传服务器。
          </p>
        </div>
      </div>

      <div className="step__actions">
        <button type="button" className="btn btn--primary" disabled={!valid} onClick={onNext}>
          下一步
        </button>
      </div>
    </div>
  );
};

export default StepBasic;
