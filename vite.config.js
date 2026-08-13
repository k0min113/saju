import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 프로젝트 루트 .env (VITE_GEMINI_API_KEY) 를 읽습니다
export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      // Windows에서 에디터가 연 대용량 PNG를 watch하면 EBUSY로 서버가 죽을 수 있음
      ignored: [
        '**/Gemini_Generated_Image_*.png',
        '**/node_modules/**',
        '**/.git/**',
      ],
    },
  },
})
