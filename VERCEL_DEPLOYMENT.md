# 🚀 Vercel 배포 가이드 (완전 무료)

## ✅ 장점
- 💳 **신용카드 불필요**
- 💰 **완전 무료**
- ⚡ **자동 배포** (git push 시)
- 🌍 **글로벌 CDN**
- 📊 **프론트 + 백엔드 모두 지원**

---

## 📋 배포 단계 (15분)

### **1단계: Vercel 계정 생성** (2분)

1. 브라우저: https://vercel.com
2. **Sign Up** 클릭
3. **Continue with GitHub** 선택
4. GitHub 계정으로 로그인
5. 권한 승인

**결과**: ✅ Vercel 계정 생성 완료

---

### **2단계: 프로젝트 Import** (3분)

1. Vercel 대시보드: https://vercel.com/dashboard
2. **Add New...** → **Project** 클릭
3. **Import Git Repository** 섹션에서:
   - `morunero211/Battle-System-YH` 검색
   - **Import** 클릭

**저장소가 안 보이면:**
```
1. "Adjust GitHub App Permissions" 클릭
2. "Battle-System-YH" 저장소 접근 허용
3. Save → 다시 Import
```

**결과**: ✅ 저장소 연동 완료

---

### **3단계: 프로젝트 설정** (5분)

**Configure Project 화면:**

```
1. [ ] Project Name: battle-system-yh (그대로 사용)
2. [ ] Framework Preset: "Other" 선택
3. [ ] Root Directory: ./ (그대로)
4. [ ] Build Command: (비워두기)
5. [ ] Output Directory: ./ (그대로)
6. [ ] Install Command: npm install (그대로)
```

**Environment Variables 추가:**
```
7. [ ] "Environment Variables" 섹션 펼치기
8. [ ] Key: NODE_ENV
       Value: production
9. [ ] Key: CORS_ORIGIN
       Value: https://battle-system-yh.vercel.app
```

**Deploy 클릭:**
```
10. [ ] "Deploy" 버튼 클릭
11. [ ] 배포 진행 대기 (2-3분)
12. [ ] 완료 시 "Visit" 클릭
```

**결과**: ✅ 프론트엔드 배포 완료

---

### **4단계: 배포 URL 확인** (1분)

**자동 생성된 URL:**
```
프론트엔드: https://battle-system-yh.vercel.app
백엔드 API: https://battle-system-yh.vercel.app/api
```

**커스텀 도메인 (선택사항):**
- Settings → Domains에서 추가 가능
- 무료로 vercel.app 서브도메인 사용 가능

**결과 기록:**
```
✅ 프론트엔드: https://battle-system-yh.vercel.app
✅ 백엔드: https://battle-system-yh.vercel.app/api
```

---

### **5단계: API URL 업데이트** (3분)

**파일 수정:** `js/config/api-config.js`

```javascript
// 기존 코드 찾기
} else if (isProduction) {
  API_BASE_URL = 'https://battle-system-backend-xxxx.run.app/api';

// 변경
} else if (isProduction) {
  API_BASE_URL = 'https://battle-system-yh.vercel.app/api';
```

**Git 커밋 및 푸시:**
```bash
cd /home/qps0211/Battle-System-YH
git add js/config/api-config.js
git commit -m "Update API URL for Vercel"
git push origin front
```

**자동 재배포:**
- Vercel이 자동으로 감지하고 재배포 (1-2분)
- Dashboard에서 배포 상태 확인

**결과**: ✅ API URL 업데이트 완료

---

### **6단계: 배포 테스트** (3분)

**테스트 1 - 프론트엔드:**
```
1. [ ] https://battle-system-yh.vercel.app 접속
2. [ ] 페이지 로드 확인
3. [ ] F12 콘솔 에러 확인
4. [ ] 캐릭터 선택 가능 확인
```

**테스트 2 - 백엔드 API:**
```
5. [ ] 터미널 또는 브라우저에서:
       https://battle-system-yh.vercel.app/api/health
6. [ ] 응답 확인:
       {
         "status": "ok",
         "message": "양호후환 전투 시스템 API 서버",
         ...
       }
```

**테스트 3 - 전투 기능:**
```
7. [ ] "▶ 전투 시작" 클릭
8. [ ] 캐릭터 선택 후 전투 진행
9. [ ] 백엔드 API 정상 호출 확인
10. [ ] 전투 결과 표시 확인
```

**결과**: ✅ 모든 테스트 통과

---

## 🎉 배포 완료!

```
✅ Vercel 계정 생성
✅ GitHub 저장소 연동
✅ 프론트엔드 배포
✅ 백엔드 API 배포
✅ API URL 업데이트
✅ 전체 테스트 완료

🚀 완전 무료 배포 성공!
```

---

## 📊 최종 결과

| 항목 | URL | 비용 |
|------|-----|------|
| **프론트엔드** | https://battle-system-yh.vercel.app | **무료** |
| **백엔드 API** | https://battle-system-yh.vercel.app/api | **무료** |
| **Firebase** | Firebase Console | **무료** |
| **총합** | | **$0/월** |

---

## 🔄 자동 배포

**코드 수정 시:**
```bash
git add .
git commit -m "update: 기능 개선"
git push origin front
# → Vercel 자동 재배포 (1-2분)
```

**배포 상태 확인:**
- https://vercel.com/dashboard
- Deployments 탭에서 실시간 확인

---

## 📈 무료 한도

**Vercel 무료 티어:**
```
✅ 대역폭: 100GB/월
✅ Serverless Functions: 100GB-시간
✅ 빌드 시간: 100시간/월
✅ 무제한 프로젝트
✅ 무제한 팀원

→ 개인 프로젝트는 충분히 무료로 운영 가능!
```

---

## 🆘 문제 해결

### 배포 실패
```
1. Vercel Dashboard → Deployments
2. 실패한 배포 클릭
3. Build Logs 확인
4. 에러 메시지 확인
```

### API 호출 안 됨
```
1. F12 콘솔 확인
2. Network 탭에서 요청 상태 확인
3. vercel.json 설정 확인
```

### 환경 변수 추가
```
1. Vercel Dashboard → 프로젝트 선택
2. Settings → Environment Variables
3. 변수 추가 → Redeploy
```

---

**완전 무료로 배포 완료!** 🎉
