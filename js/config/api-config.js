/**
 * API 설정 - 환경에 따라 자동으로 변경됨
 */

// 현재 환경 판단
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isVercel = window.location.hostname.includes('vercel.app');
const isGithubPages = window.location.hostname === 'qps0211.github.io';

// 백엔드 API URL 결정
let API_BASE_URL;

if (isDevelopment) {
  // 개발 환경: 로컬 백엔드
  API_BASE_URL = 'http://localhost:3000/api';
  console.log('🔧 개발 환경 - 로컬 백엔드 연결:', API_BASE_URL);
} else if (isVercel) {
  // 프로덕션 환경: Vercel 백엔드
  API_BASE_URL = 'https://battle-system-yh.vercel.app/api';
  console.log('🚀 프로덕션 환경 (Vercel) - 백엔드:', API_BASE_URL);
} else if (isGithubPages) {
  // GitHub Pages 환경 (백엔드 따로)
  API_BASE_URL = 'https://battle-system-backend-xxxx.run.app/api';
  console.log('🚀 프로덕션 환경 (GitHub Pages) - Cloud Run 백엔드:', API_BASE_URL);
} else {
  // 기타 환경
  API_BASE_URL = 'http://localhost:3000/api';
  console.warn('⚠️ 알 수 없는 환경 - 로컬 백엔드로 폴백:', API_BASE_URL);
}

// 전역 설정 내보내기
window.CONFIG = {
  API_BASE_URL,
  isDevelopment,
  isProduction
};

console.log('API 설정 완료:', window.CONFIG);
