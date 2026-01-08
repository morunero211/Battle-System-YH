# ✅ Firebase 연동 준비상태 체크리스트

## 📊 현재 상태 분석

### ✅ 완료된 항목

1. **Firebase SDK 로드** ✅
   - `index.html`에 Firebase SDK 스크립트 추가 완료
   - firebase-app, firebase-auth, firebase-firestore 모두 포함

2. **Firebase 설정 파일** ✅
   - `js/firebase-config.js` 생성 완료
   - 로그인/회원가입 함수 준비 완료

3. **Firestore 보안 규칙** ✅
   - `firestore.rules` 파일 생성 완료

4. **Firebase Hosting 설정** ✅
   - `firebase.json` 파일 생성 완료
   - `.firebaserc` 파일 생성 완료

5. **DataManager 연동 코드** ✅
   - Firestore 저장/로드 로직 이미 구현됨

---

## ⚠️ 아직 해야 할 작업

### 1️⃣ Firebase Console에서 프로젝트 생성 (5분)
```
🔗 https://console.firebase.google.com
→ "프로젝트 추가" 클릭
→ 프로젝트 이름: battle-program
```

### 2️⃣ Firestore Database 활성화 (2분)
```
Firebase Console → Firestore Database → 데이터베이스 만들기
→ 위치: asia-northeast3 (서울)
→ 테스트 모드로 시작
```

### 3️⃣ Authentication 설정 (2분)
```
Firebase Console → Authentication → 시작하기
→ 이메일/비밀번호: 사용 설정
→ Google: 사용 설정 (선택)
```

### 4️⃣ 웹 앱 등록 및 설정 복사 (3분) ⭐ 가장 중요!
```
Firebase Console → 프로젝트 개요 → 웹 아이콘(</>)
→ 앱 닉네임: battle-program-web
→ ✅ Firebase Hosting 설정 체크!
→ 앱 등록
```

**이때 나오는 firebaseConfig를 복사하세요!**

### 5️⃣ 설정 파일에 붙여넣기 (1분)
두 파일을 수정해야 합니다:

#### 📝 `js/firebase-config.js` (12~18번째 줄)
```javascript
// 현재 (수정 필요)
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// 수정 후 (Firebase Console에서 복사한 값)
const firebaseConfig = {
    apiKey: "AIzaSyAbc123...",  // ← 실제 값으로 교체
    authDomain: "battle-program-abc123.firebaseapp.com",
    projectId: "battle-program-abc123",
    storageBucket: "battle-program-abc123.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abc123def456"
};
```

#### 📝 `.firebaserc` (3번째 줄)
```json
{
  "projects": {
    "default": "battle-program-abc123"  // ← 실제 프로젝트 ID로 교체
  }
}
```

---

## 🎯 단계별 실행 가이드

### Step 1: Firebase Console 작업 (10분)
1. https://console.firebase.google.com 접속
2. "프로젝트 추가" → 이름 입력 → 완료
3. Firestore Database 생성 (서울 서버)
4. Authentication 활성화 (이메일/비밀번호)
5. **웹 앱 등록** → firebaseConfig 복사 📋

### Step 2: 코드에 설정 붙여넣기 (2분)
1. `js/firebase-config.js` 열기
2. 12~18번째 줄의 `YOUR_XXX` 부분을 실제 값으로 교체
3. `.firebaserc` 열기
4. `YOUR_PROJECT_ID`를 실제 프로젝트 ID로 교체
5. 저장

### Step 3: 로컬 테스트 (1분)
1. `index.html` 파일을 브라우저에서 열기
2. F12 → Console 탭 확인
3. ✅ "Firebase initialized successfully" 출력되면 성공!

### Step 4: Firebase Hosting 배포 (5분)
```powershell
# Firebase CLI 설치 (처음 한 번만)
npm install -g firebase-tools

# 로그인
firebase login

# 프로젝트 폴더 이동
cd C:\Users\qps02\OneDrive\Desktop\Battle-Program

# 프로젝트 연결
firebase use --add

# 배포!
firebase deploy
```

---

## 🔍 체크포인트

### ✅ Firebase Console 체크리스트
- [ ] 프로젝트 생성 완료
- [ ] Firestore Database 활성화
- [ ] Authentication 활성화
- [ ] 웹 앱 등록 (Firebase Hosting 체크!)
- [ ] firebaseConfig 복사 완료

### ✅ 코드 수정 체크리스트
- [ ] `js/firebase-config.js` 수정 (YOUR_XXX → 실제 값)
- [ ] `.firebaserc` 수정 (프로젝트 ID)
- [ ] 브라우저 Console에서 "Firebase initialized" 확인

### ✅ 배포 체크리스트
- [ ] Node.js 설치 (https://nodejs.org)
- [ ] Firebase CLI 설치 (`npm install -g firebase-tools`)
- [ ] Firebase 로그인 (`firebase login`)
- [ ] 배포 실행 (`firebase deploy`)
- [ ] 배포된 URL로 접속 테스트

---

## 💡 중요한 팁

### 1. Firebase Hosting 반드시 체크!
웹 앱 등록할 때 "Firebase Hosting 설정" 옵션을 꼭 체크하세요!
→ FileZilla 필요 없음
→ 한 줄 명령어로 배포
→ 무료 HTTPS/SSL

### 2. 서울 서버 선택
Firestore Database 만들 때 위치를 `asia-northeast3 (서울)`로 선택하세요!
→ 빠른 속도
→ 한 번 선택하면 변경 불가

### 3. 보안 규칙 나중에 변경
처음엔 "테스트 모드"로 시작해도 괜찮습니다.
→ 30일 후 자동으로 차단됨
→ 그때 `firestore.rules` 파일 내용으로 업데이트

---

## 🚨 주의사항

### ⚠️ apiKey는 공개해도 괜찮습니다!
- Firebase의 apiKey는 공개 키입니다
- GitHub에 올려도 문제없음
- 보안은 Firestore 규칙으로 관리

### ⚠️ 실제 값 예시
```javascript
// 잘못된 예 (이렇게 하면 안 됨)
apiKey: "YOUR_API_KEY"

// 올바른 예 (실제 값으로 교체)
apiKey: "AIzaSyBc1FG2hI3jK4lM5nO6pQ7rS8tU9vW0xY1"
```

---

## 📞 다음 단계

**지금 바로:**
1. Firebase Console 열기 → https://console.firebase.google.com
2. FIREBASE_SETUP.md 가이드 따라하기
3. firebaseConfig 복사하기
4. 저에게 "설정 완료!" 말씀하시면 코드 수정 도와드리겠습니다!

**준비 완료!** 🚀
