# 🚀 배포 가이드 (옵션 B: 분리 배포)

## 📋 목표
- **프론트엔드**: GitHub Pages (무료)
- **백엔드**: Google Cloud Run (무료 티어)
- **DB**: Firebase Firestore (무료)

---

## 🔧 1단계: 로컬 개발 환경 확인

### 프론트엔드
```bash
# 프론트엔드 서버 시작 (포트 8000)
cd /home/qps0211/Battle-System-YH
python3 -m http.server 8000
```

### 백엔드
```bash
# 백엔드 서버 시작 (포트 3000)
cd /home/qps0211/Battle-System-YH/backend
npm install
npm start
```

**확인**: `http://localhost:8000` 에서 프론트엔드 정상 작동 확인

---

## 🎯 2단계: GitHub 설정

### 2-1. 저장소 준비

```bash
# 프론트엔드 레포에 이미 초기화됨
cd /home/qps0211/Battle-System-YH
git status
```

### 2-2. GitHub Pages 활성화

1. GitHub 저장소 → Settings → Pages
2. **Source**: Deploy from a branch
3. **Branch**: main / (root)
4. **Save** 클릭

### 2-3. 백엔드 repository 생성 (선택사항)

현재는 메인 repo에 통합되어 있으나, 향후 분리 시:
```bash
mkdir ../Battle-System-Backend
cd ../Battle-System-Backend
git init
# backend 폴더 내용 복사
```

---

## ⚙️ 3단계: Google Cloud 설정

### 3-1. GCP 프로젝트 생성

1. https://console.cloud.google.com 접속
2. **새 프로젝트** 생성: `battle-system-prod`
3. 프로젝트 ID 복사 (예: `battle-system-prod-2024`)

### 3-2. Cloud Run API 활성화

```bash
gcloud projects list
gcloud config set project battle-system-prod-2024
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

### 3-3. Service Account 생성

```bash
# 서비스 계정 생성
gcloud iam service-accounts create cloud-run-deployer \
  --display-name="Cloud Run Deployer"

# IAM 역할 부여
gcloud projects add-iam-policy-binding battle-system-prod-2024 \
  --member="serviceAccount:cloud-run-deployer@battle-system-prod-2024.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding battle-system-prod-2024 \
  --member="serviceAccount:cloud-run-deployer@battle-system-prod-2024.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# JSON 키 생성
gcloud iam service-accounts keys create key.json \
  --iam-account=cloud-run-deployer@battle-system-prod-2024.iam.gserviceaccount.com
```

---

## 🔐 4단계: GitHub Secrets 설정

### GitHub Settings → Secrets and variables → Actions

**추가할 Secrets:**

1. **GCP_PROJECT_ID**
   ```
   battle-system-prod-2024
   ```

2. **GCP_SA_KEY**
   ```
   (위에서 생성한 key.json 전체 내용 복사 붙여넣기)
   ```

3. **BACKEND_URL** (배포 후 자동 생성)
   ```
   https://battle-system-backend-xxxxx.run.app
   ```

---

## 🚀 5단계: 배포 실행

### 5-1. 백엔드 배포

```bash
cd /home/qps0211/Battle-System-YH
git add backend/
git commit -m "Deploy backend to Cloud Run"
git push origin main
```

**GitHub Actions 확인:**
- Settings → Actions → Deploy Backend to Cloud Run
- 실행 완료 후 URL 확인

### 5-2. 프론트엔드 배포

```bash
# API 설정 파일에서 Cloud Run URL 업데이트
# js/config/api-config.js에서 isProduction 섹션 수정

git add .
git commit -m "Deploy frontend to GitHub Pages"
git push origin main
```

**배포 확인:**
- https://qps0211.github.io/Battle-System-YH

---

## ✅ 6단계: 배포 후 확인

### 6-1. 프론트엔드 확인
```
https://qps0211.github.io/Battle-System-YH
```

### 6-2. 백엔드 헬스 체크
```bash
curl https://battle-system-backend-xxxxx.run.app/api/health
```

### 6-3. 전체 테스트
1. 프론트엔드 접속
2. "▶ 전투 시작" 클릭
3. 백엔드 API 정상 작동 확인

---

## 📊 배포 후 모니터링

### Cloud Run 로그 확인
```bash
gcloud run services describe battle-system-backend \
  --platform managed \
  --region us-east1

# 실시간 로그
gcloud run services logs read battle-system-backend --region us-east1 --tail
```

### GitHub Pages 배포 상태
Settings → Pages → Deployments

---

## 🔄 배포 후 수정 사항 반영

### 프론트엔드 수정
```bash
git add js/ css/ index.html
git commit -m "Fix: 기능 개선"
git push origin main
# → GitHub Pages 자동 배포 (약 2-3분)
```

### 백엔드 수정
```bash
git add backend/
git commit -m "Fix: API 개선"
git push origin main
# → Cloud Run 자동 배포 (약 5-10분)
```

---

## 💰 비용 추정 (월간)

| 서비스 | 비용 |
|--------|------|
| GitHub Pages | 무료 |
| Cloud Run (180,000 vCPU/초) | ~$0.10 |
| Firebase (무료 티어) | 무료 |
| **총합** | **거의 무료** |

---

## 🆘 문제 해결

### Cloud Run 배포 실패
```bash
# 로컬에서 Docker 테스트
docker build -t battle-backend ./backend
docker run -p 8080:8080 battle-backend

# 빌드 로그 확인
gcloud builds log --stream [BUILD_ID]
```

### CORS 에러
`backend/src/server.js`의 CORS 설정 확인:
```javascript
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'https://qps0211.github.io',
  credentials: true
}));
```

### API 호출 실패
`js/config/api-config.js` 의 URL 확인:
```javascript
API_BASE_URL = 'https://battle-system-backend-xxxxx.run.app/api'
```

---

## 📝 배포 체크리스트

- [ ] GCP 프로젝트 생성
- [ ] Service Account 생성 및 JSON 키 다운로드
- [ ] GitHub Secrets 설정 (GCP_PROJECT_ID, GCP_SA_KEY)
- [ ] GitHub Pages 활성화
- [ ] 백엔드 배포 (Cloud Run)
- [ ] 프론트엔드 배포 (GitHub Pages)
- [ ] 프로덕션 API URL 확인
- [ ] 전체 기능 테스트
- [ ] 모니터링 설정

---

**배포 완료!** 🎉
