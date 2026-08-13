import { useEffect, useState } from 'react'
import Markdown from 'react-markdown'
import { supabase, hasSupabaseConfig } from './lib/supabase.js'
import './App.css'

const GENDER_LABEL = { female: '여자', male: '남자' }
const CALENDAR_LABEL = { solar: '양력', lunar: '음력' }

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

function prepareMarkdown(text) {
  return String(text || '')
    .replace(/^(\s*)[*•·]\s+/gm, '$1- ')
    .replace(/\*\*([^*]+)\*\*/g, '§§B§§$1§§/B§§')
    .replace(/\*/g, '')
    .replace(/§§B§§/g, '**')
    .replace(/§§\/B§§/g, '**')
}

export function SharedResult({ token }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reading, setReading] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      setReading(null)

      if (!hasSupabaseConfig || !supabase) {
        if (!cancelled) {
          setError('서비스 설정을 불러오지 못했습니다.')
          setLoading(false)
        }
        return
      }

      if (!token || token.length < 16) {
        if (!cancelled) {
          setError('유효하지 않은 공유 링크예요.')
          setLoading(false)
        }
        return
      }

      const { data, error: rpcError } = await supabase.rpc('get_shared_reading', {
        p_token: token,
      })

      if (cancelled) return

      if (rpcError) {
        setError(rpcError.message || '결과를 불러오지 못했습니다.')
        setLoading(false)
        return
      }

      const row = Array.isArray(data) ? data[0] : data
      if (!row?.result) {
        setError('공유된 사주 결과를 찾을 수 없어요.')
        setLoading(false)
        return
      }

      setReading(row)
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [token])

  const meta = reading
    ? formatBirthMeta({
        birthDate: reading.birth_date,
        birthTime: reading.birth_time
          ? String(reading.birth_time).slice(0, 5)
          : '',
        gender: reading.gender,
        calendarType: reading.calendar_type,
      })
    : ''

  return (
    <div className="app-shell app-shell--shared">
      <main className="page shared-page">
        <header className="shared-page__brand">
          <p className="brand-eyebrow">SAJU ME</p>
          <h1>사주 미</h1>
          <p className="shared-page__badge">RESULT</p>
          <p className="lead">친구가 공유한 사주 해석이에요.</p>
        </header>

        {loading ? (
          <section className="loading" aria-live="polite" aria-busy="true">
            <div className="loading-seal" aria-hidden="true">
              命
            </div>
            <p className="loading-title">결과를 불러오는 중</p>
          </section>
        ) : null}

        {error ? (
          <div className="error" role="alert">
            <p>{error}</p>
            <a className="ghost-btn" href="/">
              홈으로
            </a>
          </div>
        ) : null}

        {reading && !loading ? (
          <section className="result" aria-live="polite">
            <div className="result-seal" aria-hidden="true">
              命
            </div>
            <div className="result-head">
              <p className="result-eyebrow">Shared Reading</p>
              <h2>
                {reading.name ? `${reading.name}님의 해석` : '해석'}
              </h2>
              {meta ? <p className="result-meta">{meta}</p> : null}
            </div>
            <div className="result-divider" aria-hidden="true">
              <span />
              <i />
              <span />
            </div>
            <div className="result-body markdown-body">
              <Markdown>{prepareMarkdown(reading.result)}</Markdown>
            </div>
            <div className="result-actions">
              <a className="new-reading-btn new-reading-btn--inline" href="/">
                내 사주도 보기
              </a>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  )
}
