# 🔥 Firebase 설정 가이드

## 1단계: Firebase 프로젝트 생성 (5분)

### 1.1 Firebase Console 접속
1. https://console.firebase.google.com 접속
2. Google 계정으로 로그인
3. **"프로젝트 추가"** 클릭

### 1.2 프로젝트 생성
```
프로젝트 이름: battle-program (또는 원하는 이름)
Google Analytics: 선택 (권장하지만 선택사항)
위치: 대한민국
```

---

## 2단계: Firestore Database 설정 (3분)

### 2.1 Firestore 생성
1. 좌측 메뉴 **"빌드" → "Firestore Database"**
2. **"데이터베이스 만들기"** 클릭
3. **위치**: `asia-northeast3 (서울)` 선택 (한국 서버)
4. **보안 규칙**: **테스트 모드**로 시작 (나중에 변경)

### 2.2 보안 규칙 설정
1. Firestore Database → **"규칙"** 탭
2. 아래 내용으로 교체:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 사용자별 데이터 (로그인한 사용자만 자신의 데이터 접근)
    match /users/{userId}/battle/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // 전역 데이터 (모든 사용자 읽기 가능, 쓰기는 인증된 사용자만)
    match /battleApp/{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

3. **"게시"** 클릭

---

## 3단계: Authentication 설정 (3분)

### 3.1 인증 활성화
1. 좌측 메뉴 **"빌드" → "Authentication"**
2. **"시작하기"** 클릭
3. **"Sign-in method"** 탭

### 3.2 로그인 방식 추가

#### 이메일/비밀번호 (필수)
- **이메일/비밀번호** 클릭
- **사용 설정** 토글 ON
- **저장**

#### Google 로그인 (선택)
- **Google** 클릭
- **사용 설정** 토글 ON
- **프로젝트 지원 이메일** 선택
- **저장**

---

## 4단계: 웹 앱 등록 (5분)

### 4.1 앱 추가
1. 프로젝트 개요 페이지로 이동
2. **웹 아이콘(</>)** 클릭
3. 앱 닉네임: `battle-program-web`
4. ⭐ **Firebase Hosting 설정** 체크 (강력 추천!)
5. **앱 등록** 클릭

> **💡 Firebase Hosting을 체크하면?**
> - FileZilla 같은 FTP 불필요
> - 무료 HTTPS/SSL 자동 제공
> - 전 세계 CDN으로 빠른 로딩
> - 한 줄 명령어로 배포: `firebase deploy`
> - 롤백, 버전 관리 자동
> - 커스텀 도메인 연결 가능

### 4.2 Firebase SDK 구성 복사
아래와 같은 코드가 표시됩니다:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "battle-program.firebaseapp.com",
  projectId: "battle-program",
  storageBucket: "battle-program.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

**⚠️ 이 정보를 복사해두세요!**

---

## 5단계: 프로젝트에 Firebase 연동 (10분)

### 5.1 Firebase 설정 파일 수정
1. `js/firebase-config.js` 파일 열기
2. 4.2단계에서 복사한 `firebaseConfig` 붙여넣기
3. 저장

### 5.2 HTML에 Firebase SDK 추가
`index.html` 파일의 `</body>` 태그 직전에 추가:

```html
<!-- Firebase SDK -->
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js"></script>

<!-- Firebase 초기화 -->
<script src="js/firebase-config.js"></script>
```

### 5.3 파일 로드 순서 확인
최종 순서:
```html
<!-- Firebase SDK (1순위) -->
<script src="firebase sdk..."></script>
<script src="js/firebase-config.js"></script>

<!-- 클래스 파일 (2순위) -->
<script src="js/character.js"></script>
<script src="js/combat.js"></script>

<!-- 모듈 파일 (3순위) -->
<script src="js/modules/dataManager.js"></script>
...

<!-- 메인 앱 (마지막) -->
<script src="js/app.js"></script>
```

---

## 6단계: 테스트 (5분)

### 6.1 로컬 테스트
1. `index.html` 파일을 브라우저에서 열기
2. F12 → Console 확인
3. 에러 없이 `Firebase initialized` 출력되면 성공!

### 6.2 기능 테스트
1. 캐릭터 생성
2. 자동 저장 확인 (Console에 "Firestore에 저장됨" 출력)
3. Firebase Console → Firestore Database에서 데이터 확인

---

## 🆚 Firebase Hosting vs FileZilla

| 기능 | FileZilla (FTP) | Firebase Hosting ⭐ |
|------|-----------------|---------------------|
| **배포 방법** | 파일 하나씩 업로드 | `firebase deploy` 한 줄 |
| **HTTPS/SSL** | 직접 설정 필요 | 자동 무료 제공 |
| **속도** | 단일 서버 | 전 세계 CDN |
| **롤백** | 수동 백업 필요 | 클릭 한 번 |
| **가격** | 호스팅 비용 | 무료 (10GB/월) |
| **도메인** | 복잡한 설정 | 간단한 연결 |
| **Firebase 통합** | 별도 설정 | 완벽 통합 |

**결론: Firebase Hosting이 압도적으로 우수합니다!**

---

## 7단계: Firebase Hosting 배포 (필수, 10분)

### 7.1 Firebase CLI 설치
PowerShell에서 실행:
```powershell
npm install -g firebase-tools
```

### 7.2 로그인
```powershell
firebase login
```

### 7.3 프로젝트 초기화
프로젝트 폴더에서:
```powershell
cd C:\Users\qps02\OneDrive\Desktop\Battle-Program
firebase init
```

선택 사항:
- Hosting 선택 (스페이스바로 선택)
- 기존 프로젝트 사용
- public directory: `.` (현재 폴더)
- single-page app: `No`
- GitHub 자동 배포: `No`

### 7.4 배포
```powershell
firebase deploy
```

완료되면 URL 출력됨:
```
Hosting URL: https://battle-program.web.app
```

---

## 🔧 문제 해결

### "Firebase is not defined" 오류
- Firebase SDK가 로드되기 전에 앱이 실행됨
- `index.html`의 스크립트 순서 확인

### "Permission denied" 오류
- Firestore 보안 규칙 확인
- 로그인 되어 있는지 확인

### 데이터가 저장 안 됨
1. Console에서 오류 확인
2. `dataManager.js`의 `getFirestore()` 함수 확인
3. Firebase Console에서 Firestore 활성화 확인

---

## 📞 다음 단계

Firebase 설정이 완료되면:
- [ ] 로그인 기능 완성
- [ ] 자동 저장 테스트
- [ ] 전투 기록 동기화
- [ ] 다중 기기 동기화 테스트

**지금 바로 1단계부터 시작해보세요!** 🚀
