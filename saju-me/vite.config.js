import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 저장소 루트의 .env (VITE_GEMINI_API_KEY) 를 읽습니다
export default defineConfig({
  plugins: [react()],
  envDir: '..',
})
