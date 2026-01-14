# 🚀 지금부터 해야 할 일 (사용자 작업)

## ✅ 완료된 작업
- ✅ 코드 푸시 완료 (GitHub `front` branch)
- ✅ 배포 설정 파일 모두 준비됨
- ✅ GitHub Actions 워크플로우 생성됨

---

## 📋 남은 작업 (3단계)

### **1단계: GitHub Pages 활성화** (2분)

1. GitHub 저장소 접속: https://github.com/morunero211/Battle-System-YH
2. **Settings** → **Pages** 클릭
3. **Source** 설정:
   - Deploy from a branch 선택
   - Branch: `front` / `(root)` 선택
   - **Save** 클릭
4. 완료! GitHub Pages 자동 배포 시작
   - 배포 URL: `https://morunero211.github.io/Battle-System-YH`

---

### **2단계: GCP 프로젝트 생성** (10분)

#### 2-1. GCP 접속
```
https://console.cloud.google.com
```

#### 2-2. 새 프로젝트 생성
1. 상단 프로젝트 선택 → **NEW PROJECT**
2. 프로젝트명: `battle-system-prod`
3. **CREATE** 클릭
4. 프로젝트 ID 복사 (예: `battle-system-prod-2024`)

#### 2-3. Cloud Run API 활성화
1. 좌측 메뉴 → **APIs & Services** → **Library**
2. 검색: `Cloud Run API`
3. **ENABLE** 클릭
4. **Back** → **Cloud Build API** 검색 → **ENABLE**

---

### **3단계: Service Account 생성 및 키 다운로드** (5분)

#### 3-1. Service Account 생성
1. **APIs & Services** → **Credentials**
2. **+ CREATE CREDENTIALS** → **Service Account**
3. 이름: `cloud-run-deployer`
4. **CREATE AND CONTINUE**
5. 역할 선택:
   - `Cloud Run Admin`
   - `Service Account User`
6. **CONTINUE** → **DONE**

#### 3-2. 서비스 계정 키 생성
1. 생성된 서비스 계정 클릭
2. **KEYS** 탭
3. **ADD KEY** → **Create new key**
4. **JSON** 선택 → **CREATE**
5. JSON 파일 다운로드됨 (즉시 저장!)

#### 3-3. JSON 파일 내용 확인
다운로드한 JSON 파일을 텍스트 에디터로 열어 전체 내용 복사 (다음 단계에서 필요)

---

### **4단계: GitHub Secrets 설정** (3분)

#### 4-1. GitHub 저장소 Settings 접속
```
https://github.com/morunero211/Battle-System-YH/settings/secrets/actions
```

#### 4-2. 두 개의 Secrets 추가

**첫 번째 Secret: `GCP_PROJECT_ID`**
1. **New repository secret** 클릭
2. Name: `GCP_PROJECT_ID`
3. Secret: `battle-system-prod-2024` (위에서 복사한 프로젝트 ID)
4. **Add secret**

**두 번째 Secret: `GCP_SA_KEY`**
1. **New repository secret** 클릭
2. Name: `GCP_SA_KEY`
3. Secret: (위에서 다운로드한 JSON 파일 전체 내용 붙여넣기)
   ```json
   {
     "type": "service_account",
     "project_id": "battle-system-prod-2024",
     "private_key_id": "...",
     ...
   }
   ```
4. **Add secret**

---

### **5단계: 배포 모니터링** (15분 대기)

#### 5-1. GitHub Actions 확인
```
https://github.com/morunero211/Battle-System-YH/actions
```

**첫 번째 워크플로우: `Deploy Frontend to GitHub Pages`**
- 자동으로 실행됨 (2-3분)
- 완료 후 배포 URL: `https://morunero211.github.io/Battle-System-YH`

**두 번째 워크플로우: `Deploy Backend to Cloud Run`**
- 자동으로 실행됨 (5-10분)
- 로그에서 Cloud Run URL 확인 가능

#### 5-2. 배포 URL 찾기

**Cloud Run URL 찾는 방법:**
```
1. GitHub Actions → "Deploy Backend to Cloud Run" 워크플로우 클릭
2. Job logs 확인
3. "https://battle-system-backend-..." 형식의 URL 찾기
```

---

### **6단계: 프로덕션 API URL 업데이트** (2분)

배포 후 Cloud Run URL이 생성되면:

#### 6-1. Cloud Run URL 확인
```
예: https://battle-system-backend-xxxxx.run.app
```

#### 6-2. 프론트엔드 설정 파일 수정
**파일**: `js/config/api-config.js`

```javascript
// 현재:
API_BASE_URL = 'https://battle-system-backend-xxxx.run.app/api';

// 변경: 위의 Cloud Run URL로 바꾸기
API_BASE_URL = 'https://battle-system-backend-xxxxx.run.app/api';
```

#### 6-3. 커밋 및 푸시
```bash
git add js/config/api-config.js
git commit -m "feat: Update production backend URL"
git push origin front
```

---

### **7단계: 배포 후 테스트** (5분)

#### 7-1. 프론트엔드 테스트
```
https://morunero211.github.io/Battle-System-YH
```

1. 프론트엔드 접속
2. "▶ 전투 시작" 버튼 클릭
3. 백엔드 API 응답 확인

#### 7-2. 백엔드 헬스 체크
```bash
curl https://battle-system-backend-xxxxx.run.app/api/health
```

응답:
```json
{
  "status": "ok",
  "message": "양호후환 전투 시스템 API 서버",
  "firebase": "⚠️ 미연동 (메모리 폴백)",
  "timestamp": "2026-01-15T..."
}
```

---

## 📊 작업 순서 요약

```
1️⃣ GitHub Pages 활성화 (2분)
   ↓
2️⃣ GCP 프로젝트 생성 (10분)
   ↓
3️⃣ Service Account 키 생성 (5분)
   ↓
4️⃣ GitHub Secrets 설정 (3분)
   ↓
5️⃣ 배포 모니터링 (15분 대기) ← 이 동안 자동 배포 진행
   ↓
6️⃣ API URL 업데이트 (2분)
   ↓
7️⃣ 테스트 완료 (5분)
   
총 시간: ~45분
```

---

## ✅ 최종 확인 사항

```
[ ] GitHub Pages 활성화 완료
[ ] GCP 프로젝트 생성 완료
[ ] Service Account 키 생성 완료
[ ] GitHub Secrets 설정 (GCP_PROJECT_ID, GCP_SA_KEY) 완료
[ ] GitHub Actions 배포 완료
[ ] 프론트엔드 배포 확인: https://morunero211.github.io/Battle-System-YH
[ ] 백엔드 배포 확인: https://battle-system-backend-xxxxx.run.app/api/health
[ ] API URL 업데이트 완료
[ ] 전체 기능 테스트 완료
```

---

**모든 준비가 완료되었습니다!** 🎉

이제 위의 7단계를 진행하면 배포가 완료됩니다. 문제 발생 시 로그 확인 및 GitHub Actions 상태를 확인하세요.
