import { useEffect, useRef } from 'react'

export function ProfileModal({
  mode,
  open,
  draft,
  onChange,
  onSubmit,
  onClose,
  saving,
  error,
}) {
  const firstFieldRef = useRef(null)
  const isOnboarding = mode === 'onboarding'
  const canSave = Boolean(
    draft.name.trim() && draft.birthDate && draft.gender && draft.calendarType,
  )

  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => firstFieldRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [open])

  if (!open) return null

  function handleSubmit(e) {
    e.preventDefault()
    if (!canSave || saving) return
    onSubmit()
  }

  function update(field, value) {
    onChange({ ...draft, [field]: value })
  }

  return (
    <div
      className="profile-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
    >
      <div className="profile-modal__backdrop" />
      <div className="profile-modal__panel">
        <header className="profile-modal__head">
          <p className="profile-modal__eyebrow">
            {isOnboarding ? 'Welcome' : 'Profile'}
          </p>
          <h2 id="profile-modal-title">
            {isOnboarding ? '사주 정보를 알려 주세요' : '프로필 수정'}
          </h2>
          <p className="profile-modal__lead">
            {isOnboarding
              ? '처음 오신 분이에요. 필수 정보를 입력하면 다음부터 바로 사주를 볼 수 있어요.'
              : '저장된 사주 기본 정보를 수정할 수 있어요.'}
          </p>
        </header>

        <form className="profile-modal__form" onSubmit={handleSubmit}>
          <label className="field">
            <span>이름</span>
            <input
              ref={firstFieldRef}
              type="text"
              placeholder="이름을 입력하세요"
              value={draft.name}
              onChange={(e) => update('name', e.target.value)}
              required
              autoComplete="name"
            />
          </label>

          <label className="field">
            <span>생년월일</span>
            <input
              type="date"
              value={draft.birthDate}
              onChange={(e) => update('birthDate', e.target.value)}
              required
            />
          </label>

          <label className="field">
            <span>
              태어난 시간 <em className="field-optional">선택</em>
            </span>
            <input
              type="time"
              value={draft.birthTime}
              onChange={(e) => update('birthTime', e.target.value)}
            />
          </label>

          <fieldset className="field field--radio">
            <legend>성별</legend>
            <label>
              <input
                type="radio"
                name="profile-gender"
                value="female"
                checked={draft.gender === 'female'}
                onChange={(e) => update('gender', e.target.value)}
                required
              />
              여자
            </label>
            <label>
              <input
                type="radio"
                name="profile-gender"
                value="male"
                checked={draft.gender === 'male'}
                onChange={(e) => update('gender', e.target.value)}
                required
              />
              남자
            </label>
          </fieldset>

          <label className="field">
            <span>양력 / 음력</span>
            <select
              value={draft.calendarType}
              onChange={(e) => update('calendarType', e.target.value)}
              required
            >
              <option value="solar">양력</option>
              <option value="lunar">음력</option>
            </select>
          </label>

          {error ? <p className="profile-modal__error">{error}</p> : null}

          <div className="profile-modal__actions">
            {!isOnboarding ? (
              <button
                type="button"
                className="ghost-btn"
                onClick={onClose}
                disabled={saving}
              >
                취소
              </button>
            ) : null}
            <button
              type="submit"
              className="new-reading-btn new-reading-btn--inline"
              disabled={!canSave || saving}
            >
              {saving
                ? '저장 중...'
                : isOnboarding
                  ? '저장하고 시작하기'
                  : '프로필 저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
