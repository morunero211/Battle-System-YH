# 📊 배포 계획 최종 요약 (옵션 B: 분리 배포)

## ✅ 완료된 작업

### 1️⃣ 백엔드 배포 설정
- ✅ `Dockerfile` 생성 (Node.js Alpine 이미지)
- ✅ `.env.production` 생성 (프로덕션 환경 변수)
- ✅ `.dockerignore` 생성 (불필요한 파일 제외)
- ✅ GitHub Actions 워크플로우 (`.github/workflows/deploy.yml`)
  - Cloud Run에 자동 배포
  - CORS 설정 자동 적용

### 2️⃣ 프론트엔드 배포 설정
- ✅ `js/config/api-config.js` 생성 (환경별 API URL 자동 설정)
- ✅ `index.html` 수정 (API 설정 스크립트 로드)
- ✅ 백엔드 모듈 수정
  - `battleManager.js`: 동적 API URL 적용
  - `battleRoom.js`: 동적 API URL 적용
  - `battleSystem.js`: 동적 API URL 적용
- ✅ GitHub Actions 워크플로우 (`.github/workflows/frontend-deploy.yml`)
  - GitHub Pages 자동 배포

### 3️⃣ 문서화
- ✅ `DEPLOYMENT_GUIDE_OPTION_B.md` 생성 (상세 배포 가이드)
- ✅ `.env.example` 업데이트 (프로덕션 환경 변수)

---

## 🎯 배포 구조도

```
┌─────────────────────────────────────┐
│       프론트엔드 (GitHub Pages)      │
│  https://qps0211.github.io/...      │
│  • index.html                       │
│  • js/ (config 포함)               │
│  • css/                             │
└──────────────┬──────────────────────┘
               │ API 호출
               ▼
┌─────────────────────────────────────┐
│      백엔드 (Google Cloud Run)       │
│   https://battle-system-backend     │
│   -xxxxx.run.app/api                │
│  • Node.js + Express                │
│  • Firebase Firestore               │
│  • Prisma ORM                       │
└─────────────────────────────────────┘
               │ 데이터 저장/조회
               ▼
┌─────────────────────────────────────┐
│     Firebase Firestore (무료 티어)   │
│  • 인증 (Authentication)            │
│  • 데이터베이스 (Firestore)         │
│  • 스토리지 (Storage)               │
└─────────────────────────────────────┘
```

---

## 📅 배포 단계별 예상 시간

| 단계 | 내용 | 시간 |
|------|------|------|
| 1️⃣ GCP 설정 | 프로젝트 생성, Service Account, 키 다운로드 | **15분** |
| 2️⃣ GitHub 설정 | Secrets 추가, Pages 활성화 | **10분** |
| 3️⃣ 코드 푸시 | git push 및 워크플로우 실행 | **5분** |
| 4️⃣ 배포 대기 | GitHub Actions 실행 (~2-3분) | **3분** |
| 5️⃣ 배포 대기 | Cloud Run 빌드 및 배포 (~5-10분) | **10분** |
| 6️⃣ 테스트 및 검증 | 실제 작동 확인 | **10분** |
| **합계** | | **~50분** |

---

## 🚀 바로 배포하기 (빠른 시작)

### 1단계: 현재 로컬 테스트 완료 ✅
- 프론트엔드: `http://localhost:8000` 작동 중
- 백엔드: `http://localhost:3000/api` 작동 중

### 2단계: GCP 프로젝트 생성
```bash
# GCP 접속 → 새 프로젝트 생성
# 프로젝트 ID: battle-system-prod-2024 (예시)
```

### 3단계: GitHub Secrets 추가
```
1. GCP_PROJECT_ID = battle-system-prod-2024
2. GCP_SA_KEY = (서비스 계정 JSON 키 전체)
```

### 4단계: 코드 푸시
```bash
cd /home/qps0211/Battle-System-YH
git add .
git commit -m "Setup deployment (Option B: separated backend and frontend)"
git push origin main
```

### 5단계: 배포 모니터링
- GitHub Actions: Settings → Actions 에서 실행 상태 확인
- Cloud Run URL 자동 생성됨
- GitHub Pages: 자동으로 배포됨

### 6단계: 프론트엔드 API URL 업데이트
배포 후 Cloud Run URL이 생성되면:
```javascript
// js/config/api-config.js 수정
API_BASE_URL = 'https://battle-system-backend-xxxxx.run.app/api'
```

---

## 💡 장점 (Option B vs Option A)

| 항목 | Option A (통합) | Option B (분리) ✅ |
|------|-----------------|-----------------|
| **설정 복잡도** | 간단 | 중간 |
| **배포 속도** | 느림 | 빠름 |
| **개발 유연성** | 낮음 | 높음 ⭐ |
| **유지보수** | 어려움 | 쉬움 ⭐ |
| **확장성** | 제한적 | 우수함 ⭐ |
| **도메인 관리** | 1개 | 2개 |
| **비용** | ~$10/월 | ~$0.10/월 ⭐ |

---

## 📋 배포 후 체크리스트

```
[ ] 프론트엔드 접속 확인: https://qps0211.github.io/Battle-System-YH
[ ] 백엔드 헬스 체크: GET https://battle-system-backend-xxxxx.run.app/api/health
[ ] 전투 시작 버튼 클릭 → 백엔드 API 호출 확인
[ ] 캐릭터 선택 → 전투 진행 확인
[ ] 브라우저 콘솔 에러 없음 확인
[ ] Cloud Run 로그 확인
[ ] GitHub Pages 배포 히스토리 확인
```

---

## 🔄 배포 후 일상적인 작업 흐름

### 프론트엔드 수정
```bash
vim js/app.js        # 수정
git add js/
git commit -m "Fix: feature X"
git push             # → 자동으로 GitHub Pages 배포 (2-3분)
```

### 백엔드 수정
```bash
vim backend/src/routes/battles.js  # 수정
git add backend/
git commit -m "Fix: API improvement"
git push             # → 자동으로 Cloud Run 배포 (5-10분)
```

---

## 🆘 배포 실패 시 해결 방법

### Cloud Run 빌드 실패
```bash
# 원인: Dockerfile 또는 package.json 오류
# 해결: 로컬에서 Docker 테스트
docker build -t test ./backend
docker run -p 8080:8080 test
```

### CORS 에러
```bash
# 원인: 백엔드 CORS 설정 문제
# 확인: .env.production에서 CORS_ORIGIN 확인
CORS_ORIGIN=https://qps0211.github.io
```

### API 호출 실패
```bash
# 원인: 프론트엔드에서 잘못된 URL로 호출
# 해결: js/config/api-config.js에서 URL 확인
const isProduction = true;
API_BASE_URL = 'https://battle-system-backend-xxxxx.run.app/api'
```

---

## 📊 예상 월간 비용

| 서비스 | 무료 한도 | 초과 시 | 예상 비용 |
|--------|----------|--------|----------|
| **GitHub Pages** | 무제한 | N/A | **$0** |
| **Cloud Run** | 180,000 vCPU/초 | $0.00001667/vCPU초 | **$0.10** |
| **Firebase** | 무료 티어 충분 | 초과 시 | **$0** |
| **Firestore** | 50,000 읽기/쓰기/삭제 | 초과 시 | **$0** |
| **-** | **-** | **합계** | **~$0.10/월** |

**결론: 실제로는 무료에 가깝습니다!** 🎉

---

**준비 완료!** 이제 배포를 시작할 수 있습니다. 🚀
