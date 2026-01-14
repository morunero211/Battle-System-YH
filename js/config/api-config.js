/**
 * API 설정 - 환경에 따라 자동으로 변경됨
 */

// 현재 환경 판단
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isProduction = window.location.hostname === 'qps0211.github.io';

// 백엔드 API URL 결정
let API_BASE_URL;

if (isDevelopment) {
  // 개발 환경: 로컬 백엔드
  API_BASE_URL = 'http://localhost:3000/api';
  console.log('🔧 개발 환경 - 로컬 백엔드 연결:', API_BASE_URL);
} else if (isProduction) {
  // 프로덕션 환경: Cloud Run 백엔드
  // 배포 후에는 Cloud Run URL로 자동 변경됨
  API_BASE_URL = 'https://battle-system-backend-xxxx.run.app/api';
  console.log('🚀 프로덕션 환경 - Cloud Run 백엔드:', API_BASE_URL);
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
