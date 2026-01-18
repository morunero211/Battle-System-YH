/**
 * API 설정 - 환경에 따라 자동으로 변경됨
 */

// 현재 환경 판단
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isVercel = window.location.hostname.includes('vercel.app');
const isGithubPages = window.location.hostname === 'qps0211.github.io';

const shouldLog = isDevelopment;

// 백엔드 API URL 결정
let API_BASE_URL;

if (isDevelopment) {
  // 개발 환경: 로컬 백엔드
  API_BASE_URL = 'http://localhost:3000/api';
  if (shouldLog) console.log('🔧 개발 환경 - 로컬 백엔드 연결:', API_BASE_URL);
} else if (isVercel) {
  // 프로덕션 환경: Vercel(프론트와 동일 오리진의 Serverless API)
  // NOTE: 특정 도메인으로 고정하면 preview/prod 도메인 불일치로 404/NOT_FOUND가 발생할 수 있으므로
  // 항상 현재 오리진을 기준으로 /api 를 사용합니다.
  API_BASE_URL = `${window.location.origin}/api`;
  if (shouldLog) console.log('🚀 프로덕션 환경 (Vercel) - 동일 오리진 API:', API_BASE_URL);
} else if (isGithubPages) {
  // GitHub Pages 환경 (백엔드 따로)
  API_BASE_URL = 'https://battle-system-backend-xxxx.run.app/api';
  if (shouldLog) console.log('🚀 프로덕션 환경 (GitHub Pages) - Cloud Run 백엔드:', API_BASE_URL);
} else {
  // 기타 환경
  API_BASE_URL = 'http://localhost:3000/api';
  console.warn('⚠️ 알 수 없는 환경 - 로컬 백엔드로 폴백:', API_BASE_URL);
}

// 전역 설정 내보내기
window.CONFIG = {
  API_BASE_URL,
  isDevelopment,
  isVercel,
  isGithubPages
};

if (shouldLog) {
  console.log('🔗 API 설정 완료:');
  console.log('   API_BASE_URL:', window.CONFIG.API_BASE_URL);
  console.log('   hostname:', window.location.hostname);
  console.log('   isDevelopment:', window.CONFIG.isDevelopment);
  console.log('   isVercel:', window.CONFIG.isVercel);
}
