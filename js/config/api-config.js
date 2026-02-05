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
  isGithubPages,

  // 전투 화면: 복붙용 텍스트 모달 상단에 붙는 안내 문구
  // (요청 문구 그대로 출력)
  BATTLE_COPY_GUIDE_TEXT: `- 안내문구

첫 순서는 민첩이 더 높은 사람이 가져갑니다.
(스탯이 같을 경우 다이스를 굴립니다.)

모든 턴에 10분 이내에 답 달지 않으면 해당 본인의 턴은 스킵, 3회 이상 스킵될 시 패배로 인정됩니다. (혹시 급히 자리 비워야할 시 언급으로 알려주시면 감사하겠습니다.)

모든 행동 지문에는 전투를 진행중인 @관리진 분을 언급해 주세요.

전투를 시작하기 직전입니다. 전투 행동 양식은 아래와 같습니다. 필요시 복사해서 사용해주세요.

*스킬 사용 가능 횟수는 (지원형의 턴 스킵 제외) 모든 전투 포함 1회입니다.

*체력이 50이 되면 전투 불능 상태가 되어 전투가 종료됩니다.

—--

[ @관리진 / 공격,회피,반격,스킬 / @(행동) ]
자유 문구 + (행동지문)

—--

(*방어형의 경우 자신의 차례나 상대방이 공격형 스킬을 (본인포함) 아군에게 썼을 때 사용 가능합니다.)

모두 준비가 되셨다면 ok 표정을 찍어주세요. 모두 찍어주시면 전투가 시작됩니다.`
};

if (shouldLog) {
  console.log('🔗 API 설정 완료:');
  console.log('   API_BASE_URL:', window.CONFIG.API_BASE_URL);
  console.log('   hostname:', window.location.hostname);
  console.log('   isDevelopment:', window.CONFIG.isDevelopment);
  console.log('   isVercel:', window.CONFIG.isVercel);
}
