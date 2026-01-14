# 📋 배포 체크리스트 - 단계별 실행 가이드

## 🎯 목표
GitHub Pages + Google Cloud Run을 이용한 **완전한 프로덕션 배포**

## ⏱️ 예상 소요 시간: 45분

---

## 📍 현재 상태

```
✅ 코드 작성 완료
✅ 배포 설정 파일 생성 완료
✅ GitHub 푸시 완료
⏳ 사용자 작업 필요 (아래 7단계)
```

---

## 🚀 실행 체크리스트

### ☐ **1단계: GitHub Pages 활성화** (2분)

**목표**: 프론트엔드를 자동으로 배포할 준비

```
1. [ ] 브라우저: https://github.com/morunero211/Battle-System-YH
2. [ ] Settings 탭 클릭
3. [ ] 좌측 메뉴 → Pages
4. [ ] Source: "Deploy from a branch"
5. [ ] Branch: "front" / "(root)" 선택
6. [ ] Save 클릭
7. [ ] 배포 URL 기록: https://morunero211.github.io/Battle-System-YH
```

**결과**: ✅ GitHub Pages 활성화 완료

---

### ☐ **2단계: GCP 프로젝트 생성** (10분)

**목표**: Google Cloud에서 백엔드를 배포할 프로젝트 생성

```
1. [ ] 브라우저: https://console.cloud.google.com
2. [ ] 상단의 프로젝트 선택 → "NEW PROJECT"
3. [ ] 프로젝트명: battle-system-prod
4. [ ] CREATE 클릭 (약 1분 대기)
5. [ ] 프로젝트 ID 복사
   예: battle-system-prod-2024
6. [ ] 메모: GCP_PROJECT_ID = ___________
```

**API 활성화:**
```
7. [ ] 왼쪽 메뉴 → APIs & Services → Library
8. [ ] 검색: "Cloud Run API"
9. [ ] ENABLE 클릭
10. [ ] 뒤로 가기
11. [ ] 검색: "Cloud Build API"
12. [ ] ENABLE 클릭
```

**결과**: ✅ GCP 프로젝트 및 API 활성화 완료

---

### ☐ **3단계: Service Account 생성** (5분)

**목표**: GitHub Actions가 GCP에 배포할 수 있는 권한 생성

```
1. [ ] APIs & Services → Credentials
2. [ ] "+ CREATE CREDENTIALS" → "Service Account"
3. [ ] Service account name: cloud-run-deployer
4. [ ] CREATE AND CONTINUE
5. [ ] Grant this service account access to project
    - [ ] Select a role: "Cloud Run Admin"
    - [ ] "Grant another role" 클릭
    - [ ] "Service Account User" 추가
6. [ ] CONTINUE
7. [ ] DONE
```

**결과**: ✅ Service Account 생성 완료

---

### ☐ **4단계: 서비스 계정 키 생성** (3분)

**목표**: GitHub가 사용할 JSON 인증 키 생성

```
1. [ ] 방금 생성한 Service Account 클릭
2. [ ] KEYS 탭
3. [ ] ADD KEY → "Create new key"
4. [ ] Key type: "JSON"
5. [ ] CREATE 클릭
6. [ ] JSON 파일 자동 다운로드
7. [ ] 파일 저장 위치 확인
8. [ ] 텍스트 에디터로 열기 (전체 내용 복사 준비)

메모: 다운로드한 파일의 이름은?
_______________________________
```

**결과**: ✅ JSON 키 파일 생성 완료

---

### ☐ **5단계: GitHub Secrets 설정** (3분)

**목표**: GitHub Actions가 GCP에 접근할 수 있는 인증정보 저장

```
1. [ ] 브라우저: https://github.com/morunero211/Battle-System-YH/settings/secrets/actions
2. [ ] "New repository secret" 클릭
```

**Secret 1 - GCP 프로젝트 ID:**
```
3. [ ] Name: GCP_PROJECT_ID
4. [ ] Secret: (3단계에서 복사한 프로젝트 ID 붙여넣기)
       예: battle-system-prod-2024
5. [ ] Add secret
```

**Secret 2 - GCP 서비스 계정 키:**
```
6. [ ] "New repository secret" 다시 클릭
7. [ ] Name: GCP_SA_KEY
8. [ ] Secret: (4단계의 JSON 파일 전체 내용 복사 붙여넣기)
       {
         "type": "service_account",
         "project_id": "...",
         ...
       }
9. [ ] Add secret
```

**결과**: ✅ GitHub Secrets 설정 완료

---

### ☐ **6단계: 자동 배포 모니터링** (15분 대기)

**목표**: GitHub Actions가 자동으로 배포 진행

```
1. [ ] 브라우저: https://github.com/morunero211/Battle-System-YH/actions
2. [ ] 워크플로우 목록 확인:
    - [ ] "Deploy Frontend to GitHub Pages" (2-3분)
    - [ ] "Deploy Backend to Cloud Run" (5-10분)

모니터링:
3. [ ] 각 워크플로우 클릭
4. [ ] 상태 확인: ✓ (초록색 = 성공)
5. [ ] 완료될 때까지 대기
```

**결과 기록:**
```
백엔드 배포 URL: https://battle-system-backend-__________.run.app
프론트엔드 배포 URL: https://morunero211.github.io/Battle-System-YH
```

---

### ☐ **7단계: API URL 업데이트** (2분)

**목표**: 프론트엔드가 배포된 백엔드와 통신하도록 설정

**이전 상태**: 로컬 개발용 (localhost:3000)
**이후 상태**: 프로덕션용 (Cloud Run URL)

```
1. [ ] VS Code 또는 텍스트 에디터 열기
2. [ ] 파일 열기: js/config/api-config.js
3. [ ] isProduction 섹션 찾기:
    
    } else if (isProduction) {
      API_BASE_URL = 'https://battle-system-backend-xxxx.run.app/api';
    
4. [ ] "battle-system-backend-xxxx.run.app" 부분을 6단계에서 얻은 URL로 변경
       예: https://battle-system-backend-abc123def.run.app/api
5. [ ] 저장 (Ctrl+S)
```

**Git 커밋:**
```
6. [ ] 터미널 열기
7. [ ] cd /home/qps0211/Battle-System-YH
8. [ ] git add js/config/api-config.js
9. [ ] git commit -m "Update production backend URL"
10. [ ] git push origin front
```

**자동 배포:**
```
11. [ ] GitHub Pages 자동 배포됨 (2-3분)
12. [ ] 배포 완료 확인
```

**결과**: ✅ API URL 업데이트 완료

---

### ☐ **8단계: 배포 후 테스트** (5분)

**목표**: 모든 것이 정상 작동하는지 확인

**테스트 1 - 프론트엔드 접속:**
```
1. [ ] 브라우저: https://morunero211.github.io/Battle-System-YH
2. [ ] 페이지 로드 확인
3. [ ] 콘솔 에러 확인 (F12)
4. [ ] 캐릭터 선택 가능한지 확인
```

**테스트 2 - 백엔드 헬스 체크:**
```
5. [ ] 터미널 또는 Postman 사용
6. [ ] GET https://battle-system-backend-xxxxx.run.app/api/health
7. [ ] 응답 확인:
    {
      "status": "ok",
      "message": "양호후환 전투 시스템 API 서버",
      ...
    }
```

**테스트 3 - 전투 기능:**
```
8. [ ] 프론트엔드에서 "▶ 전투 시작" 클릭
9. [ ] 캐릭터 선택 후 전투 진행
10. [ ] 백엔드 API 호출 확인 (로그 무한 스크롤 X)
11. [ ] 전투 결과 표시 확인
```

**테스트 4 - Cloud Run 로그:**
```
12. [ ] GCP Console: https://console.cloud.google.com
13. [ ] Cloud Run 선택
14. [ ] battle-system-backend 서비스 클릭
15. [ ] LOGS 탭에서 API 호출 로그 확인
```

**결과**: ✅ 모든 테스트 통과

---

## 🎉 배포 완료 확인

```
☑️ GitHub Pages 활성화
☑️ GCP 프로젝트 생성
☑️ Service Account 생성
☑️ GitHub Secrets 설정
☑️ 자동 배포 완료
☑️ API URL 업데이트
☑️ 모든 테스트 통과

🚀 프로덕션 배포 완료!
```

---

## 📊 최종 결과

| 항목 | URL | 상태 |
|------|-----|------|
| **프론트엔드** | https://morunero211.github.io/Battle-System-YH | ✅ 배포됨 |
| **백엔드** | https://battle-system-backend-xxxxx.run.app | ✅ 배포됨 |
| **Firestore** | Firebase Console | ✅ 준비됨 |

---

## 💡 배포 후 유지보수

### 코드 수정 시 자동 배포

**프론트엔드 수정:**
```bash
git add js/
git commit -m "fix: bug fix"
git push origin front
# → GitHub Pages 자동 배포 (2-3분)
```

**백엔드 수정:**
```bash
git add backend/
git commit -m "fix: API improvement"
git push origin front
# → Cloud Run 자동 배포 (5-10분)
```

---

## 🆘 문제 해결

### Cloud Run 배포 실패
- Cloud Run 워크플로우 로그 확인
- 에러 메시지 읽기
- Dockerfile 또는 package.json 문법 확인

### API 연결 불가
- `js/config/api-config.js`의 URL 확인
- Browser Console (F12) 에러 확인
- Cloud Run 서비스 상태 확인

### GitHub Pages 배포 안 됨
- Settings → Pages → Deployments 확인
- GitHub Actions 워크플로우 상태 확인

---

**시작하세요!** 🚀
