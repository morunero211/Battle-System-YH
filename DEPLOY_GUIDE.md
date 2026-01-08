# 🚀 Firebase Hosting 배포 가이드

## FileZilla를 버리고 Firebase Hosting을 사용해야 하는 이유

### ✅ Firebase Hosting의 장점

1. **한 줄로 배포**
   `나``powershell
   firebase deploy
   ```
   - FileZilla: 파일 하씩 선택 → 업로드 → 대기
   - Firebase: 명령어 하나로 전체 배포 완료

2. **무료 HTTPS/SSL**
   - 자동으로 `https://` 주소 제공
   - 보안 경고 없음
   - 추가 설정 불필요

3. **전 세계 CDN**
   - 한국, 미국, 유럽 어디서든 빠름
   - Firebase가 자동으로 가장 가까운 서버에서 제공

4. **버전 관리 & 롤백**
   - 이전 버전으로 즉시 복구 가능
   - Firebase Console에서 클릭 한 번

5. **Firebase 서비스와 완벽 통합**
   - Firestore, Authentication과 자동 연동
   - CORS 문제 없음

---

## 🎯 빠른 배포 (5분)

### 1단계: Firebase CLI 설치
```powershell
npm install -g firebase-tools
```

> 💡 **Node.js가 없다면?**
> https://nodejs.org 에서 LTS 버전 설치 후 진행

### 2단계: 로그인
```powershell
firebase login
```
- 브라우저가 열리면 Google 계정으로 로그인
- 터미널에 "Success!" 표시 확인

### 3단계: 프로젝트 폴더로 이동
```powershell
cd C:\Users\qps02\OneDrive\Desktop\Battle-Program
```

### 4단계: Firebase 프로젝트 연결
```powershell
firebase use --add
```
- 화살표로 프로젝트 선택
- alias: `default` 입력

### 5단계: 배포!
```powershell
firebase deploy
```

**완료!** 🎉
```
Hosting URL: https://your-project.web.app
```

---

## 📝 배포 후 확인사항

### ✅ 체크리스트
- [ ] 배포 URL로 접속
- [ ] 캐릭터 생성 테스트
- [ ] 로그인 테스트
- [ ] Firestore 저장 확인
- [ ] 다른 기기에서도 접속 테스트

### 🔧 배포 후 수정하기
파일 수정 → `firebase deploy` 다시 실행 → 끝!

---

## 🌐 커스텀 도메인 연결 (선택)

자신만의 도메인 (예: `battle.com`)을 사용하고 싶다면:

### 1. 도메인 구매
- Cloudflare, 가비아, 호스팅케이알 등에서 구매

### 2. Firebase Console에서 연결
1. Firebase Console → Hosting
2. "도메인 추가" 클릭
3. 구매한 도메인 입력
4. DNS 레코드 설정 안내 따르기

### 3. DNS 설정
- 도메인 등록업체 사이트에서 A 레코드 추가
- Firebase가 제공하는 IP 주소 입력

### 4. 완료
- 몇 시간 후 `https://your-domain.com`으로 접속 가능!

---

## ⚡ 고급 배포 기능

### 미리보기 채널 (테스트 배포)
```powershell
firebase hosting:channel:deploy preview
```
- 실제 사이트는 그대로
- 테스트용 임시 URL 생성

### 롤백 (이전 버전으로 복구)
Firebase Console → Hosting → 버전 기록 → "롤백" 클릭

### 배포 시간 단축
```powershell
firebase deploy --only hosting
```
- Firestore 규칙 등은 건너뛰고 Hosting만 배포

---

## 🎊 비교표: FileZilla vs Firebase Hosting

| 작업 | FileZilla | Firebase Hosting |
|------|-----------|------------------|
| **초기 설정** | FTP 정보 입력, 서버 연결 | `firebase login` 한 번 |
| **배포** | 폴더 선택 → 업로드 (5분) | `firebase deploy` (30초) |
| **업데이트** | 변경된 파일 찾아서 재업로드 | 명령어 하나로 자동 |
| **HTTPS** | 수동 SSL 인증서 구매 & 설치 | 자동 무료 |
| **속도** | 서버 위치에 따라 다름 | 전 세계 어디서나 빠름 |
| **실수 복구** | 백업 파일 찾아서 재업로드 | 클릭 한 번으로 롤백 |
| **비용** | 월 5,000원~20,000원 | 무료 (일반 사용) |

---

## 💰 Firebase Hosting 무료 한도

**무료 Spark 플랜:**
- 저장 용량: 10GB
- 전송량: 월 360MB/day
- 커스텀 도메인: 무제한
- SSL: 자동 무료

**일반 웹사이트는 무료로 충분합니다!**

---

## 🆘 문제 해결

### "firebase: command not found" 오류
```powershell
npm install -g firebase-tools
```
실행 후 PowerShell 재시작

### "Permission denied" 오류
관리자 권한으로 PowerShell 실행:
```powershell
Start-Process powershell -Verb RunAs
```

### 배포 후 변경사항이 안 보임
브라우저 캐시 삭제:
- Chrome: `Ctrl + Shift + Delete`
- 또는 시크릿 모드로 접속

---

## 🎯 결론

**FileZilla를 사용할 이유가 전혀 없습니다!**

Firebase Hosting은:
- ✅ 더 빠름
- ✅ 더 안전 (HTTPS)
- ✅ 더 편함 (한 줄 배포)
- ✅ 더 저렴 (무료!)
- ✅ Firebase 서비스와 완벽 통합

**지금 바로 Firebase Hosting으로 배포하세요!** 🚀
