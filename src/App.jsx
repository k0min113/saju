import { useState, useEffect, useRef } from 'react'
import Markdown from 'react-markdown'
import { buildSajuPrompt } from './prompt.js'
import { supabase, hasSupabaseConfig } from './lib/supabase.js'
import { ProfileModal } from './ProfileModal.jsx'
import './App.css'

const LOADING_STEPS = [
  '사주 명식을 펼치는 중',
  '오행의 균형을 살피는 중',
  '기질과 재능을 풀어내는 중',
  '해석 문장을 다듬는 중',
]

const EMPTY_PROFILE_DRAFT = {
  name: '',
  birthDate: '',
  birthTime: '',
  gender: '',
  calendarType: 'solar',
}

const GENDER_LABEL = { female: '여자', male: '남자' }
const CALENDAR_LABEL = { solar: '양력', lunar: '음력' }
const READING_SELECT = `
  id,
  result,
  share_token,
  created_at,
  user_id,
  users (
    name,
    birth_date,
    birth_time,
    gender,
    calendar_type
  )
`

function readingDisplay(reading) {
  const profile = reading?.users
  return {
    name: profile?.name ?? reading?.name ?? '이름 없음',
    birthDate: profile?.birth_date ?? reading?.birth_date ?? '',
    birthTime: profile?.birth_time
      ? String(profile.birth_time).slice(0, 5)
      : reading?.birth_time
        ? String(reading.birth_time).slice(0, 5)
        : '',
    gender: profile?.gender ?? reading?.gender ?? '',
    calendarType: profile?.calendar_type ?? reading?.calendar_type ?? 'solar',
  }
}

function formatBirthMeta({ birthDate, birthTime, gender, calendarType }) {
  const parts = []
  if (birthDate) parts.push(birthDate)
  if (birthTime) parts.push(birthTime)
  if (calendarType && CALENDAR_LABEL[calendarType]) {
    parts.push(CALENDAR_LABEL[calendarType])
  }
  if (gender && GENDER_LABEL[gender]) parts.push(GENDER_LABEL[gender])
  return parts.join(' · ')
}

function formatHistoryDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** 화면에 * 기호가 그대로 안 보이게 마크다운을 정리합니다 */
function prepareMarkdown(text) {
  return text
    .replace(/^(\s*)[*•·]\s+/gm, '$1- ')
    .replace(/\*\*([^*]+)\*\*/g, '§§B§§$1§§/B§§')
    .replace(/\*/g, '')
    .replace(/§§B§§/g, '**')
    .replace(/§§\/B§§/g, '**')
}

function App() {
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [profileModalMode, setProfileModalMode] = useState('onboarding')
  const [profileDraft, setProfileDraft] = useState(EMPTY_PROFILE_DRAFT)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState('')

  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [birthTime, setBirthTime] = useState('')
  const [gender, setGender] = useState('')
  const [calendarType, setCalendarType] = useState('solar')

  const [result, setResult] = useState('')
  const [shareToken, setShareToken] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loadingStep, setLoadingStep] = useState(0)

  const [readings, setReadings] = useState([])
  const [readingsLoading, setReadingsLoading] = useState(false)
  const [readingsError, setReadingsError] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [resultReveal, setResultReveal] = useState(0)
  const [formOpen, setFormOpen] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [toast, setToast] = useState(null)

  const resultRef = useRef(null)
  const nameInputRef = useRef(null)
  const formRef = useRef(null)
  const toastTimerRef = useRef(null)

  const isEditing = Boolean(selectedId && formOpen && !loading)
  const isViewingSaved = Boolean(selectedId && result && !loading && !formOpen)
  const canSubmit = Boolean(user && name.trim() && birthDate && gender)
  const hasSavedProfile = Boolean(
    profile?.name && profile?.birth_date && profile?.gender,
  )
  const needsOnboarding = Boolean(
    user && authReady && !profileLoading && !hasSavedProfile,
  )
  const showProfileModal = profileModalOpen || needsOnboarding
  const activeModalMode = needsOnboarding ? 'onboarding' : profileModalMode

  function applyProfileToForm(nextProfile) {
    if (!nextProfile) return
    setName(nextProfile.name ?? '')
    setBirthDate(nextProfile.birth_date ?? '')
    setBirthTime(
      nextProfile.birth_time ? String(nextProfile.birth_time).slice(0, 5) : '',
    )
    setGender(nextProfile.gender ?? '')
    setCalendarType(nextProfile.calendar_type ?? 'solar')
  }

  function profileToDraft(nextProfile, fallbackName = '') {
    return {
      name: nextProfile?.name ?? fallbackName ?? '',
      birthDate: nextProfile?.birth_date ?? '',
      birthTime: nextProfile?.birth_time
        ? String(nextProfile.birth_time).slice(0, 5)
        : '',
      gender: nextProfile?.gender ?? '',
      calendarType: nextProfile?.calendar_type ?? 'solar',
    }
  }

  function clearFormFields() {
    setName('')
    setBirthDate('')
    setBirthTime('')
    setGender('')
    setCalendarType('solar')
  }

  function openEditProfile() {
    setProfileError('')
    setProfileModalMode('edit')
    setProfileDraft(profileToDraft(profile))
    setProfileModalOpen(true)
  }

  function closeProfileModal() {
    if (needsOnboarding) return
    setProfileModalOpen(false)
    setProfileError('')
  }

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) {
      setAuthReady(true)
      return
    }

    let cancelled = false

    async function initAuth() {
      const { data, error: sessionError } = await supabase.auth.getSession()
      if (cancelled) return
      if (sessionError) {
        console.error(sessionError)
      }
      setUser(data.session?.user ?? null)
      setAuthReady(true)
    }

    initAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setAuthReady(true)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) {
      setReadings([])
      setProfile(null)
      setReadingsLoading(false)
      return
    }

    if (!user) {
      setProfile(null)
      setReadings([])
      setReadingsError('')
      setReadingsLoading(false)
      setSelectedId(null)
      setResult('')
      clearFormFields()
      setFormOpen(true)
      setProfileModalOpen(false)
      setProfileDraft(EMPTY_PROFILE_DRAFT)
      setProfileError('')
      return
    }

    let cancelled = false

    async function loadUserData() {
      setProfileLoading(true)
      setReadingsLoading(true)
      setReadingsError('')

      const [profileRes, readingsRes] = await Promise.all([
        supabase.from('users').select('*').eq('id', user.id).maybeSingle(),
        supabase
          .from('saju_readings')
          .select(READING_SELECT)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
      ])

      if (cancelled) return

      if (profileRes.error) {
        console.error(profileRes.error)
        setError(profileRes.error.message || '프로필을 불러오지 못했습니다.')
      } else {
        setProfile(profileRes.data)
        if (profileRes.data) {
          applyProfileToForm(profileRes.data)
          setProfileModalOpen(false)
        } else {
          const fallbackName =
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            ''
          setProfileDraft(profileToDraft(null, fallbackName))
          setProfileModalMode('onboarding')
          setProfileModalOpen(true)
        }
      }

      if (readingsRes.error) {
        setReadingsError('기록을 불러오지 못했습니다.')
        setReadings([])
      } else {
        setReadings(readingsRes.data ?? [])
      }

      setProfileLoading(false)
      setReadingsLoading(false)
    }

    loadUserData()
    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    if (!loading) {
      setLoadingStep(0)
      return
    }
    const id = setInterval(() => {
      setLoadingStep((step) => (step + 1) % LOADING_STEPS.length)
    }, 1800)
    return () => clearInterval(id)
  }, [loading])

  useEffect(() => {
    if (!result || loading) return
    const id = requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return () => cancelAnimationFrame(id)
  }, [resultReveal, result, loading])

  async function loginWithGoogle() {
    setError('')
    if (!supabase) {
      setError('Supabase 환경 변수가 설정되지 않았습니다.')
      return
    }
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    })
    if (authError) {
      setError(authError.message || 'Google 로그인에 실패했습니다.')
    }
  }

  async function logout() {
    setError('')
    if (!supabase) {
      setError('Supabase 환경 변수가 설정되지 않았습니다.')
      return
    }
    const { error: authError } = await supabase.auth.signOut()
    if (authError) {
      setError(authError.message || '로그아웃에 실패했습니다.')
    }
  }

  function showToast(message) {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current)
    }
    setToast({ id: Date.now(), message, leaving: false })
    toastTimerRef.current = setTimeout(() => {
      setToast((prev) => (prev ? { ...prev, leaving: true } : null))
      toastTimerRef.current = setTimeout(() => {
        setToast(null)
        toastTimerRef.current = null
      }, 420)
    }, 2200)
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current)
      }
    }
  }, [])

  function openReading(reading) {
    const display = readingDisplay(reading)
    setSelectedId(reading.id)
    setShareToken(reading.share_token || null)
    setName(display.name === '이름 없음' ? '' : display.name)
    setBirthDate(display.birthDate)
    setBirthTime(display.birthTime)
    setGender(display.gender)
    setCalendarType(display.calendarType)
    setResult(reading.result ?? '')
    setResultReveal((n) => n + 1)
    setError('')
    setFormOpen(false)
  }

  function startNewReading() {
    const alreadyOnNewPage =
      formOpen && !selectedId && !result && !loading && !isViewingSaved

    if (alreadyOnNewPage) {
      showToast('이미 새 사주 화면이 열려 있어요')
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      requestAnimationFrame(() => {
        nameInputRef.current?.focus()
      })
      return
    }

    setSelectedId(null)
    setShareToken(null)
    setResult('')
    setError('')
    setFormOpen(true)
    if (profile) {
      applyProfileToForm(profile)
    } else {
      clearFormFields()
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
    requestAnimationFrame(() => {
      nameInputRef.current?.focus()
    })
    showToast('새 사주 화면으로 이동했어요')
  }

  function beginEditReading() {
    setFormOpen(true)
    setResult('')
    setError('')
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      nameInputRef.current?.focus()
    })
  }

  async function deleteReading(id, readingName) {
    if (!id) return
    if (!supabase) {
      setError('Supabase 환경 변수가 설정되지 않았습니다.')
      return
    }
    const ok = window.confirm(
      `"${readingName || '이 기록'}"을(를) 삭제할까요? 되돌릴 수 없습니다.`,
    )
    if (!ok) return

    setBusyId(id)
    setError('')
    const { error: deleteError } = await supabase
      .from('saju_readings')
      .delete()
      .eq('id', id)

    setBusyId(null)
    if (deleteError) {
      setError(deleteError.message || '기록 삭제에 실패했습니다.')
      return
    }

    setReadings((prev) => prev.filter((item) => item.id !== id))
    if (selectedId === id) {
      startNewReading()
    }
  }

  async function upsertUserProfile(source) {
    const profilePayload = {
      id: user.id,
      name: source.name.trim(),
      birth_date: source.birthDate,
      birth_time: source.birthTime || null,
      gender: source.gender || null,
      calendar_type: source.calendarType,
      updated_at: new Date().toISOString(),
    }

    const { data, error: profileError } = await supabase
      .from('users')
      .upsert(profilePayload, { onConflict: 'id' })
      .select('*')
      .single()

    if (profileError) {
      throw new Error(profileError.message || '프로필 저장에 실패했습니다.')
    }

    setProfile(data)
    applyProfileToForm(data)
    return data
  }

  async function saveProfileFromModal() {
    if (!user || !supabase) return
    setProfileSaving(true)
    setProfileError('')
    try {
      await upsertUserProfile({
        name: profileDraft.name,
        birthDate: profileDraft.birthDate,
        birthTime: profileDraft.birthTime,
        gender: profileDraft.gender,
        calendarType: profileDraft.calendarType,
      })
      setProfileModalOpen(false)
      setFormOpen(true)
    } catch (err) {
      setProfileError(err?.message || '프로필 저장에 실패했습니다.')
    } finally {
      setProfileSaving(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!user) {
      setError('Google 로그인 후 사주를 볼 수 있어요.')
      return
    }
    if (!supabase) {
      setError('Supabase 환경 변수가 설정되지 않았습니다.')
      return
    }
    if (!canSubmit || loading) return

    const editingId = selectedId
    setError('')
    setResult('')
    setLoading(true)

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY
      if (!apiKey) {
        throw new Error('VITE_GEMINI_API_KEY 가 설정되지 않았습니다.')
      }

      const model = 'gemini-3.6-flash'
      const prompt = buildSajuPrompt({
        name: name.trim(),
        birthDate,
        birthTime,
        gender,
        calendarType,
      })

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        },
      )

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error?.message || '사주 해석 요청에 실패했습니다.')
      }

      const text =
        data?.candidates?.[0]?.content?.parts
          ?.map((part) => part.text ?? '')
          .join('') ?? ''

      if (!text) {
        throw new Error('모델 응답이 비어 있습니다.')
      }

      setResult(text)
      setResultReveal((n) => n + 1)
      setFormOpen(false)

      await upsertUserProfile({
        name,
        birthDate,
        birthTime,
        gender,
        calendarType,
      })

      const readingPayload = {
        user_id: user.id,
        result: text,
      }

      let saved
      let saveError

      if (editingId) {
        ;({ data: saved, error: saveError } = await supabase
          .from('saju_readings')
          .update(readingPayload)
          .eq('id', editingId)
          .eq('user_id', user.id)
          .select(READING_SELECT)
          .single())
      } else {
        ;({ data: saved, error: saveError } = await supabase
          .from('saju_readings')
          .insert(readingPayload)
          .select(READING_SELECT)
          .single())
      }

      if (saveError) {
        console.error(saveError)
        setError(
          `해석은 완료됐지만 ${editingId ? '수정' : '저장'}에 실패했습니다: ${saveError.message}`,
        )
        return
      }

      setReadings((prev) => {
        const without = prev.filter((item) => item.id !== saved.id)
        return [saved, ...without]
      })
      setSelectedId(saved.id)
      setShareToken(saved.share_token || null)
    } catch (err) {
      setError(err?.message || '사주 해석 요청에 실패했습니다.')
      setFormOpen(true)
    } finally {
      setLoading(false)
    }
  }

  async function shareCurrentReading() {
    if (!shareToken) {
      showToast('공유 링크를 아직 만들 수 없어요')
      return
    }

    const url = `${window.location.origin}/result/${shareToken}`
    const title = name ? `${name}님의 사주 해석` : '사주 해석'

    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title, text: `${title}을 확인해 보세요`, url })
        return
      }
    } catch (err) {
      if (err?.name === 'AbortError') return
    }

    try {
      await navigator.clipboard.writeText(url)
      showToast('공유 링크를 복사했어요')
    } catch {
      showToast(url)
    }
  }

  const resultMeta = formatBirthMeta({
    birthDate,
    birthTime,
    gender,
    calendarType,
  })

  return (
    <div className="app-shell">
      {!hasSupabaseConfig ? (
        <div className="error" role="alert" style={{ gridColumn: '1 / -1' }}>
          <p>Supabase 설정을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
        </div>
      ) : null}

      <header className="auth-bar" aria-label="계정">
        {!authReady ? (
          <p className="auth-bar__status">로그인 상태 확인 중…</p>
        ) : user ? (
          <>
            <div className="auth-bar__user">
              <p className="auth-bar__label">Signed in</p>
              <p className="auth-bar__email">{user.email}</p>
              {profileLoading ? (
                <p className="auth-bar__hint">프로필 불러오는 중…</p>
              ) : hasSavedProfile ? (
                <p className="auth-bar__hint">
                  {profile.name} · {profile.birth_date}
                  {profile.gender
                    ? ` · ${GENDER_LABEL[profile.gender] || profile.gender}`
                    : ''}
                </p>
              ) : (
                <p className="auth-bar__hint">사주 정보를 먼저 등록해 주세요</p>
              )}
            </div>
            <div className="auth-bar__actions">
              {hasSavedProfile ? (
                <button type="button" className="ghost-btn" onClick={openEditProfile}>
                  프로필
                </button>
              ) : null}
              <button type="button" className="ghost-btn" onClick={logout}>
                로그아웃
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="auth-bar__user">
              <p className="auth-bar__label">Welcome</p>
              <p className="auth-bar__hint">Google 계정으로 로그인해 주세요</p>
            </div>
            <button type="button" className="google-btn" onClick={loginWithGoogle}>
              Google로 시작하기
            </button>
          </>
        )}
      </header>

      <aside className="history-sidebar" aria-label="저장된 사주 기록">
        <p className="history-sidebar__label">Archive</p>
        <h2 className="history-sidebar__title">지난 사주</h2>
        <div className="history-sidebar__rule" aria-hidden="true" />
        <button
          type="button"
          className={
            !isViewingSaved && formOpen && !result && !selectedId
              ? 'new-reading-btn is-current'
              : 'new-reading-btn'
          }
          onClick={startNewReading}
        >
          사주 만들기
        </button>

        {!user ? (
          <p className="history-sidebar__empty">
            로그인하면 내 사주 기록만 볼 수 있어요.
          </p>
        ) : null}

        {user && readingsLoading ? (
          <p className="history-sidebar__empty">기록을 불러오는 중…</p>
        ) : null}

        {user && readingsError ? (
          <p className="history-sidebar__error">{readingsError}</p>
        ) : null}

        {user && !readingsLoading && !readingsError && readings.length === 0 ? (
          <p className="history-sidebar__empty">
            아직 저장된 기록이 없습니다.
            <br />
            새 사주를 만들어 보세요.
          </p>
        ) : null}

        {user && !readingsLoading && readings.length > 0 ? (
          <>
            <p className="history-sidebar__count">{readings.length}개의 기록</p>
            <ul className="history-list">
              {readings.map((reading) => {
                const display = readingDisplay(reading)
                return (
                  <li key={reading.id} className="history-list__row">
                    <button
                      type="button"
                      className={
                        selectedId === reading.id
                          ? 'history-list__item is-active'
                          : 'history-list__item'
                      }
                      onClick={() => openReading(reading)}
                    >
                      <span className="history-list__name">{display.name}</span>
                      <span className="history-list__meta">
                        {display.birthDate || formatHistoryDate(reading.created_at)}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="history-list__delete"
                      aria-label={`${display.name} 기록 삭제`}
                      disabled={busyId === reading.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteReading(reading.id, display.name)
                      }}
                    >
                      삭제
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        ) : null}
      </aside>

      <main className="page">
        {isViewingSaved ? (
          <section className="view-banner" aria-live="polite">
            <div className="view-banner__mark" aria-hidden="true">
              命
            </div>
            <div className="view-banner__text">
              <p className="view-banner__label">Saved Reading</p>
              <h2 className="view-banner__title">{name}님의 사주</h2>
              {resultMeta ? <p className="view-banner__meta">{resultMeta}</p> : null}
            </div>
            <div className="view-banner__actions">
              <button
                type="button"
                className="share-btn"
                onClick={shareCurrentReading}
                disabled={!shareToken}
              >
                공유하기
              </button>
              <button type="button" className="ghost-btn" onClick={beginEditReading}>
                수정하기
              </button>
              <button
                type="button"
                className="ghost-btn ghost-btn--danger"
                disabled={busyId === selectedId}
                onClick={() => deleteReading(selectedId, name)}
              >
                삭제
              </button>
              <button
                type="button"
                className="new-reading-btn new-reading-btn--inline"
                onClick={startNewReading}
              >
                사주 만들기
              </button>
            </div>
          </section>
        ) : null}

        {formOpen || loading ? (
          <div className="sheet" ref={formRef}>
            <header className="brand">
              <p className="brand-eyebrow">SAJU ME</p>
              <div className="brand-seal" aria-hidden="true">
                命
              </div>
              <h1>사주 미</h1>
              <div className="brand-ornament" aria-hidden="true">
                <span />
                <i />
                <span />
              </div>
              <p className="lead">
                {loading
                  ? `${name || '당신'}님의 사주를 풀이하고 있습니다.`
                  : isEditing
                    ? '정보를 수정한 뒤 다시 풀이하면 기록이 업데이트됩니다.'
                    : hasSavedProfile
                      ? '프로필 정보로 바로 사주를 볼 수 있어요.'
                      : '로그인 후 사주 정보를 등록해 주세요.'}
              </p>
            </header>

            <form
              className={`saju-form${loading ? ' saju-form--busy' : ''}`}
              onSubmit={handleSubmit}
            >
              {isEditing ? (
                <p className="edit-mode-badge" role="status">
                  수정 모드 · 기존 기록을 업데이트합니다
                </p>
              ) : null}

              {user && hasSavedProfile && !isEditing ? (
                <section className="profile-summary" aria-label="내 사주 정보">
                  <div className="profile-summary__mark" aria-hidden="true">
                    命
                  </div>
                  <div className="profile-summary__body">
                    <p className="profile-summary__label">My Profile</p>
                    <h3 className="profile-summary__name">{profile.name}</h3>
                    <p className="profile-summary__meta">
                      {formatBirthMeta({
                        birthDate: profile.birth_date,
                        birthTime: profile.birth_time
                          ? String(profile.birth_time).slice(0, 5)
                          : '',
                        gender: profile.gender,
                        calendarType: profile.calendar_type,
                      })}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={openEditProfile}
                  >
                    프로필 수정
                  </button>
                </section>
              ) : null}

              {(!hasSavedProfile || isEditing) && user ? (
                <>
                  <label className="field">
                    <span>이름</span>
                    <input
                      ref={nameInputRef}
                      type="text"
                      placeholder="이름을 입력하세요"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      autoComplete="name"
                    />
                  </label>

                  <label className="field">
                    <span>생년월일</span>
                    <input
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      required
                    />
                  </label>

                  <label className="field">
                    <span>
                      태어난 시간 <em className="field-optional">선택</em>
                    </span>
                    <input
                      type="time"
                      value={birthTime}
                      onChange={(e) => setBirthTime(e.target.value)}
                    />
                  </label>

                  <fieldset className="field field--radio">
                    <legend>성별</legend>
                    <label>
                      <input
                        type="radio"
                        name="gender"
                        value="female"
                        checked={gender === 'female'}
                        onChange={(e) => setGender(e.target.value)}
                        required
                      />
                      여자
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="gender"
                        value="male"
                        checked={gender === 'male'}
                        onChange={(e) => setGender(e.target.value)}
                        required
                      />
                      남자
                    </label>
                  </fieldset>

                  <label className="field">
                    <span>양력 / 음력</span>
                    <select
                      value={calendarType}
                      onChange={(e) => setCalendarType(e.target.value)}
                    >
                      <option value="solar">양력</option>
                      <option value="lunar">음력</option>
                    </select>
                  </label>
                </>
              ) : null}

              <p className={`preview${name.trim() ? '' : ' preview--empty'}`}>
                {name.trim()
                  ? `${name.trim()}님의 사주`
                  : '프로필을 등록하면 미리보기가 나타납니다'}
              </p>

              {user ? (
                hasSavedProfile || isEditing ? (
                  <button
                    type="submit"
                    className={`submit${loading ? ' submit--loading' : ''}`}
                    disabled={loading || !canSubmit}
                    aria-busy={loading}
                  >
                    {loading ? (
                      <>
                        <span className="submit-spinner" aria-hidden="true" />
                        풀이 중...
                      </>
                    ) : isEditing ? (
                      '다시 풀이하고 수정'
                    ) : (
                      '내 사주 보기'
                    )}
                  </button>
                ) : (
                  <div className="login-gate">
                    <p className="login-gate__text">
                      사주 정보를 등록하면 바로 풀이를 시작할 수 있어요.
                    </p>
                    <button
                      type="button"
                      className="new-reading-btn new-reading-btn--inline"
                      onClick={() => {
                        setProfileModalMode('onboarding')
                        setProfileModalOpen(true)
                      }}
                    >
                      정보 등록하기
                    </button>
                  </div>
                )
              ) : (
                <div className="login-gate">
                  <p className="login-gate__text">
                    로그인하면 사주를 풀이하고 결과를 저장할 수 있어요.
                  </p>
                  <button type="button" className="google-btn" onClick={loginWithGoogle}>
                    Google로 시작하기
                  </button>
                </div>
              )}

              {isEditing && !loading ? (
                <button
                  type="button"
                  className="ghost-btn ghost-btn--block"
                  onClick={startNewReading}
                >
                  수정 취소 · 내 프로필로 풀이
                </button>
              ) : null}

              {user && isEditing && !canSubmit && !loading ? (
                <p className="form-hint">
                  이름, 생년월일, 성별을 입력하면 시작할 수 있어요.
                </p>
              ) : null}
            </form>
          </div>
        ) : null}

        {loading ? (
          <section className="loading" aria-live="polite" aria-busy="true">
            <div className="loading-seal" aria-hidden="true">
              命
            </div>
            <p className="loading-title">사주 풀이 중</p>
            <p className="loading-hint" key={loadingStep}>
              {name ? `${name}님 — ` : ''}
              {LOADING_STEPS[loadingStep]}
            </p>
            <div className="loading-bar" aria-hidden="true">
              <span />
            </div>
            <ul className="loading-steps" aria-hidden="true">
              {LOADING_STEPS.map((step, index) => (
                <li
                  key={step}
                  className={
                    index === loadingStep
                      ? 'loading-steps__item is-active'
                      : index < loadingStep
                        ? 'loading-steps__item is-done'
                        : 'loading-steps__item'
                  }
                >
                  {step}
                </li>
              ))}
            </ul>
            <p className="loading-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </p>
          </section>
        ) : null}

        {error ? (
          <div className="error" role="alert">
            <p>{error}</p>
            <button type="button" className="ghost-btn" onClick={() => setError('')}>
              닫기
            </button>
          </div>
        ) : null}

        {result && !loading ? (
          <section
            ref={resultRef}
            key={resultReveal}
            className="result"
            aria-live="polite"
          >
            <div className="result-seal" aria-hidden="true">
              命
            </div>
            <div className="result-head">
              <p className="result-eyebrow">Reading</p>
              <h2>{name ? `${name}님의 해석` : '해석'}</h2>
              {resultMeta ? <p className="result-meta">{resultMeta}</p> : null}
            </div>
            <div className="result-divider" aria-hidden="true">
              <span />
              <i />
              <span />
            </div>
            <div className="result-body markdown-body">
              <Markdown>{prepareMarkdown(result)}</Markdown>
            </div>
            <div className="result-actions">
              {shareToken ? (
                <button type="button" className="share-btn" onClick={shareCurrentReading}>
                  공유하기
                </button>
              ) : null}
              {selectedId ? (
                <>
                  <button type="button" className="ghost-btn" onClick={beginEditReading}>
                    수정하기
                  </button>
                  <button
                    type="button"
                    className="ghost-btn ghost-btn--danger"
                    disabled={busyId === selectedId}
                    onClick={() => deleteReading(selectedId, name)}
                  >
                    삭제
                  </button>
                </>
              ) : null}
              <button
                type="button"
                className="new-reading-btn new-reading-btn--inline"
                onClick={startNewReading}
              >
                사주 만들기
              </button>
            </div>
          </section>
        ) : null}
      </main>

      <ProfileModal
        mode={activeModalMode}
        open={showProfileModal}
        draft={profileDraft}
        onChange={setProfileDraft}
        onSubmit={saveProfileFromModal}
        onClose={closeProfileModal}
        saving={profileSaving}
        error={profileError}
      />

      {toast ? (
        <div
          className={toast.leaving ? 'app-toast is-leaving' : 'app-toast'}
          role="status"
          aria-live="polite"
          key={toast.id}
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  )
}

export default App
