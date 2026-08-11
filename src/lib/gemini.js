import { GoogleGenAI } from '@google/genai/web'
import {
  DEFAULT_SAJU_SYSTEM_PROMPT,
  buildSajuUserInput,
} from './sajuPrompt.js'

const MODEL = 'gemini-3.6-flash'

function getClient() {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  if (!apiKey) {
    throw new Error(
      'VITE_GEMINI_API_KEY 가 없습니다. 저장소 루트 .env 를 확인해 주세요.',
    )
  }
  // 브라우저에서는 환경변수를 자동으로 못 읽으므로 apiKey를 직접 넘깁니다
  return new GoogleGenAI({ apiKey })
}

/**
 * Gemini Interactions API 로 사주 기본차트 해석을 요청합니다.
 * @returns {Promise<string>} 한국어 해석 텍스트
 */
export async function interpretSaju(formValues) {
  const client = getClient()

  const interaction = await client.interactions.create({
    model: MODEL,
    // 기본 사주 해석 프롬프트 (명식 포함)
    system_instruction: DEFAULT_SAJU_SYSTEM_PROMPT,
    // 폼에서 받은 내담자 정보
    input: buildSajuUserInput(formValues),
    // 개인 생년월일 정보가 서버에 오래 남지 않도록 저장 옵트아웃
    store: false,
    // Gemini 3.6: temperature 대신 thinking_level 사용
    generation_config: {
      thinking_level: 'medium',
    },
  })

  const text = interaction.output_text
  if (!text) {
    throw new Error('모델 응답이 비어 있습니다. 잠시 후 다시 시도해 주세요.')
  }
  return text
}
