import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages 프로젝트 사이트 하위 경로(https://<id>.github.io/day3_rpa/).
  // 커스텀 도메인/유저페이지면 '/'로 변경. 개발 서버는 base 무시.
  base: process.env.VITE_BASE ?? '/day3_rpa/',
  server: {
    // 개발 중 /api 요청을 FastAPI(8000)로 프록시
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
