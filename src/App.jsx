import { useState, useEffect } from 'react'
import Markdown from 'react-markdown'
import { buildSajuPrompt } from './prompt.js'
import './App.css'

const LOADING_STEPS = [
  '사주 명식을 펼치는 중',
  '오행의 균형을 살피는 중',
  '기질과 재능을 풀어내는 중',
  '해석 문장을 다듬는 중',
]

/** 화면에 * 기호가 그대로 안 보이게 마크다운을 정리합니다 */
function prepareMarkdown(text) {
  return text
    // * / - 불릿을 표준 리스트로 통일
    .replace(/^(\s*)[*•·]\s+/gm, '$1- ')
    // 굵게(**text**)는 잠시 보호
    .replace(/\*\*([^*]+)\*\*/g, '§§B§§$1§§/B§§')
    // 남은 단독 * 제거 (깨진 강조 등)
    .replace(/\*/g, '')
    // 굵게 복원
    .replace(/§§B§§/g, '**')
    .replace(/§§\/B§§/g, '**')
}

function App() {
  // ① 이름 — input에 입력한 값이 여기에 저장됩니다
  const [name, setName] = useState('')

  // ② 생년월일 — type="date" 값은 "YYYY-MM-DD" 문자열로 들어옵니다
  const [birthDate, setBirthDate] = useState('')

  // ③ 태어난 시간 — type="time" 값은 "HH:MM" 문자열로 들어옵니다
  const [birthTime, setBirthTime] = useState('')

  // ④ 성별 — radio의 value("female" | "male")가 저장됩니다
  const [gender, setGender] = useState('')

  // ⑤ 양력/음력 — select의 value("solar" | "lunar")가 저장됩니다
  const [calendarType, setCalendarType] = useState('solar')

  // Gemini 해석 결과 / 로딩 / 에러
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loadingStep, setLoadingStep] = useState(0)

  // 풀이 중일 때 안내 문구를 순환해서 보여 줍니다
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

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setResult('')
    setLoading(true)

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY
      if (!apiKey) {
        throw new Error('VITE_GEMINI_API_KEY 가 설정되지 않았습니다.')
      }

      // gemini-2.5-flash 는 deprecated → gemini-3.6-flash 사용
      const model = 'gemini-3.6-flash'
      const prompt = buildSajuPrompt({
        name,
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
    } catch (err) {
      setError(err?.message || '사주 해석 요청에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="page">
      <div className="sheet">
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
          <p className="lead">사주 보기 전, 기본 정보를 입력해 주세요.</p>
        </header>

        <form
          className={`saju-form${loading ? ' saju-form--busy' : ''}`}
          onSubmit={handleSubmit}
        >
          {/* ---------- 1) 이름 ---------- */}
          <label className="field">
            <span>이름</span>
            {/*
              value={name}  → 화면에 보이는 글자를 state와 맞춥니다 (controlled input)
              onChange      → 사용자가 칠 때마다 setName으로 state를 갱신합니다
              e.target.value → 지금 입력창에 들어 있는 문자열
            */}
            <input
              type="text"
              placeholder="이름을 입력하세요"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          {/* ---------- 2) 생년월일 ---------- */}
          <label className="field">
            <span>생년월일</span>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </label>

          {/* ---------- 3) 태어난 시간 ---------- */}
          <label className="field">
            <span>태어난 시간</span>
            <input
              type="time"
              value={birthTime}
              onChange={(e) => setBirthTime(e.target.value)}
            />
          </label>

          {/* ---------- 4) 성별 (radio) ---------- */}
          <fieldset className="field field--radio">
            <legend>성별</legend>
            {/*
              같은 name 속성을 쓰면 브라우저가 둘 중 하나만 선택하게 해 줍니다.
              checked는 "지금 state와 이 버튼의 value가 같은가?"로 결정합니다.
            */}
            <label>
              <input
                type="radio"
                name="gender"
                value="female"
                checked={gender === 'female'}
                onChange={(e) => setGender(e.target.value)}
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
              />
              남자
            </label>
          </fieldset>

          {/* ---------- 5) 양력 / 음력 (select) ---------- */}
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

          <p className="preview">{name}님의 사주</p>

          <button
            type="submit"
            className={`submit${loading ? ' submit--loading' : ''}`}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? (
              <>
                <span className="submit-spinner" aria-hidden="true" />
                풀이 중...
              </>
            ) : (
              '내 사주 보기'
            )}
          </button>
        </form>
      </div>

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
        <p className="error" style={{ color: 'red' }}>
          {error}
        </p>
      ) : null}

      {result ? (
        <section className="result" aria-live="polite">
          <div className="result-head">
            <h2>해석</h2>
          </div>
          <div className="result-body markdown-body">
            <Markdown>{prepareMarkdown(result)}</Markdown>
          </div>
        </section>
      ) : null}
    </main>
  )
}

export default App
