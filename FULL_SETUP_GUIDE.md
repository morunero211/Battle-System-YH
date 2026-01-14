# 양호후환 전투 시스템 - 통합 설정 가이드

## 📋 개요

이 프로젝트는 **하이브리드 아키텍처**로 구성되어 있습니다:

```
┌─────────────────────────────────────────────────────────────┐
│              프론트엔드 (HTML/CSS/JavaScript)               │
│            http://localhost:8000                           │
│  - 전투 UI/UX                                              │
│  - 캐릭터 관리                                              │
│  - 실시간 전투 로그                                         │
└──────────┬──────────────────────────────┬──────────────────┘
           │                              │
           ↓ Fetch API                    ↓ SDK
    ┌──────────────┐              ┌──────────────┐
    │ 백엔드 API    │              │   Firebase   │
    │ :3000        │◄────────────►│  (Auth+DB)   │
    └──────────────┘              └──────────────┘
    - d100 시뮬레이션
    - 전투 처리 로직
    - 메모리/Firestore 저장
```

**특징:**
- ✅ **무료**: Firebase 무료 티어만 사용
- ✅ **확장 가능**: 백엔드 API로 복잡한 로직 처리 가능
- ✅ **실시간**: Firestore 실시간 리스닝 지원
- ✅ **보안**: Firebase Authentication + Firestore Rules

---

## 🚀 빠른 시작 (5분)

### 1단계: 프론트엔드 시작

```bash
# 프로젝트 폴더로 이동
cd /home/qps0211/Battle-System-YH

# 간단한 HTTP 서버 시작 (포트 8000)
python3 -m http.server 8000
```

브라우저에서 `http://localhost:8000` 접속

### 2단계: 백엔드 시작

```bash
# 새 터미널 탭에서
cd /home/qps0211/Battle-System-YH/backend

npm install  # 처음 한 번만
npm start    # 서버 시작 (포트 3000)
```

### 3단계: 확인

- 프론트엔드: http://localhost:8000
- 백엔드 API: http://localhost:3000/api/health
- 헬스 체크 응답:
  ```json
  {
    "status": "ok",
    "firebase": "⚠️ 미연동 (메모리 폴백)"
  }
  ```

---

## 🔧 상세 설정

### 💡 폴백 모드란?

**폴백(Fallback) 모드**는 Firebase Firestore가 연동되지 않았을 때 **자동으로 메모리 저장소를 사용**하는 기능입니다.

#### 정상 모드 vs 폴백 모드

| 항목 | 정상 모드 (Firestore) | 폴백 모드 (메모리) |
|-----|---------------------|-----------------|
| **저장소** | Firebase Firestore | 서버 메모리 (RAM) |
| **영구성** | ✅ 영구 저장 | ⚠️ 재시작 시 삭제 |
| **설정** | serviceAccountKey.json 필요 | 추가 설정 불필요 |
| **용도** | 프로덕션 환경 | 개발/테스트 |
| **비용** | 무료 (Firebase 무료 티어) | 무료 |

#### 작동 방식

```javascript
// backend/src/config/firebase.js
if (serviceAccountKey.json이 존재) {
  ✅ Firebase Firestore 사용 (영구 저장)
} else {
  ⚠️ 메모리 폴백 모드 (임시 저장)
}
```

#### 현재 모드 확인

```bash
curl http://localhost:3000/api/health
```

**응답:**
```json
{
  "status": "ok",
  "firebase": "⚠️ 미연동 (메모리 폴백)"  // ← 현재 폴백 모드
}
```

또는

```json
{
  "status": "ok",
  "firebase": "✅ 연동됨"  // ← Firestore 정상 모드
}
```

#### 폴백 모드의 장단점

**👍 장점:**
- Firebase 설정 없이 **즉시 개발/테스트 가능**
- 서비스 계정 키 없이도 모든 API 작동
- 에러 없이 안정적으로 작동
- 개발 중 빠른 반복 작업 가능

**👎 단점:**
- 서버 재시작 시 **모든 데이터 손실**
- 프로덕션 환경에서는 사용 불가
- 여러 서버 인스턴스 간 데이터 공유 불가

#### 폴백 모드 → 정상 모드 전환

1. Firebase 서비스 계정 키 다운로드 (아래 섹션 참조)
2. `backend/serviceAccountKey.json`에 저장
3. 백엔드 서버 재시작: `npm start`
4. 헬스 체크에서 `"✅ 연동됨"` 확인

**💡 팁:** 개발 중에는 폴백 모드로도 충분합니다! 배포 전에만 Firestore 연동하면 됩니다.

---

### A. Firebase 설정 (선택사항 - Firestore 연동 시)

#### Step 1: Firebase 콘솔 접속

1. https://console.firebase.google.com 접속
2. **battle-yangho** 프로젝트 선택
3. ✅ 이미 설정되어 있음 (Authentication + Firestore)

#### Step 2: 서비스 계정 키 다운로드

1. ⚙️ **프로젝트 설정** 클릭
2. **서비스 계정** 탭
3. **Node.js** 탭 확인
4. **새 개인 키 생성** 클릭
5. JSON 파일이 자동으로 다운로드됨

#### Step 3: 키 배치

```bash
# 다운로드한 파일을 이름 변경하여 저장
cp ~/Downloads/battle-yangho-*.json /home/qps0211/Battle-System-YH/backend/serviceAccountKey.json
```

#### Step 4: 서버 재시작

```bash
cd /home/qps0211/Battle-System-YH/backend
npm start
```

헬스 체크에서 `firebase: "✅ 연동됨"` 확인

---

### B. 프론트엔드 설정

프론트엔드는 **이미 설정되어 있습니다**.

**확인할 파일:** [js/firebase-config.js](js/firebase-config.js)

```javascript
const firebaseConfig = {
  apiKey: "...",
  authDomain: "battle-yangho.firebaseapp.com",
  projectId: "battle-yangho",
  ...
};
```

**기능:**
- ✅ Firebase Authentication (로그인)
- ✅ Firestore 실시간 업데이트
- ✅ 캐릭터 데이터 저장

---

### C. 백엔드 설정

#### 필수 파일

**1. `backend/package.json`**
```json
{
  "dependencies": {
    "express": "4.18.2",
    "firebase-admin": "12.0.0",
    "cors": "2.8.5",
    "dotenv": "16.0.3"
  }
}
```

**2. `backend/.env`**
```dotenv
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:8000
JWT_SECRET=battle-system-super-secret-key-2026
```

**3. `backend/.env.local` (Firestore 연동 시)**
```dotenv
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
```

**4. `backend/src/config/firebase.js`**
```javascript
const admin = require('firebase-admin');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

module.exports = { admin, db, auth, firebaseInitialized };
```

#### 폴더 구조

```
backend/
├── src/
│   ├── server.js           # Express 앱 진입점
│   ├── config/
│   │   └── firebase.js     # Firebase 초기화
│   └── routes/
│       └── battles.js      # 전투 API 라우트
├── package.json
├── .env
├── .env.local              # 로컬 개발용
├── .env.example
├── serviceAccountKey.json  # Firebase 키 (미리 생성)
└── server.log             # 서버 로그
```

---

## 📱 프론트엔드 개발 팁

### API 호출 예제

```javascript
// 전투 시뮬레이션 (백엔드 사용)
const battleResult = await fetch('http://localhost:3000/api/battles/simulate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    attacker: player,
    defender: enemy
  })
});

// 전투 기록 저장 (Firebase + 백엔드)
await fetch('http://localhost:3000/api/battles/record', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: currentUser.uid,  // Firebase Auth
    teams: battleTeams,
    winner: winner,
    log: battleLog,
    duration: Date.now() - startTime
  })
});
```

### Firebase Auth 사용 (이미 구현됨)

```javascript
// 로그인 상태 확인
firebase.auth().onAuthStateChanged(user => {
  if (user) {
    console.log('로그인됨:', user.uid, user.email);
    // 백엔드 API 호출 시 userId 사용
  } else {
    console.log('로그아웃됨');
  }
});
```

---

## 🔌 API 엔드포인트 (빠른 참조)

| 메서드 | 엔드포인트 | 설명 |
|--------|----------|------|
| GET | `/api/health` | 서버 상태 확인 |
| POST | `/api/battles/simulate` | d100 전투 시뮬레이션 |
| POST | `/api/battles/record` | 전투 기록 저장 |
| GET | `/api/battles/history` | 전투 기록 조회 |

**상세 가이드:** [BACKEND_API_GUIDE.md](BACKEND_API_GUIDE.md)

---

## 🛠️ 개발 명령어

```bash
# 프론트엔드 시작 (포트 8000)
cd /home/qps0211/Battle-System-YH
python3 -m http.server 8000

# 백엔드 시작 (포트 3000)
cd /home/qps0211/Battle-System-YH/backend
npm start

# 백엔드 개발 모드 (자동 재시작)
npm run dev

# 백엔드 테스트
npm test

# 패키지 업데이트
npm update

# 로그 확인
tail -f backend/server.log
```

---

## 🔍 문제 해결

### 1. "Cannot find module 'firebase-admin'"

```bash
# 패키지 설치
cd backend
npm install
```

### 2. "EADDRINUSE: address already in use :::3000"

```bash
# 포트 3000 사용 중인 프로세스 종료
lsof -i :3000
kill -9 <PID>
```

### 3. "CORS 에러"

백엔드 `server.js`에서 CORS 설정 확인:

```javascript
app.use(cors({
  origin: 'http://localhost:8000',  // 프론트엔드 주소
  credentials: true
}));
```

### 4. Firebase 연동 안 됨

```bash
# 1. 서비스 계정 키 확인
ls -la backend/serviceAccountKey.json

# 2. 파일 권한 확인
chmod 600 backend/serviceAccountKey.json

# 3. 서버 로그 확인
tail -f backend/server.log
```

---

## 📊 실시간 모니터링

### 서버 상태 확인

```bash
# 자동 갱신 (2초마다)
watch -n 2 'curl -s http://localhost:3000/api/health'
```

### 전투 기록 조회

```bash
curl "http://localhost:3000/api/battles/history?userId=test-user&limit=5"
```

---

## 🚢 배포 준비

### 1. 환경 변수 설정

**.env** (프로덕션):
```dotenv
NODE_ENV=production
PORT=80
CORS_ORIGIN=https://yourdomain.com
```

### 2. Firebase 프로덕션 규칙

**firestore.rules**:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/battles/{document=**} {
      allow read, write: if request.auth.uid == userId;
    }
  }
}
```

### 3. 배포 플랫폼 제안

- **프론트엔드**: Netlify, Vercel, GitHub Pages
- **백엔드**: Heroku, Google Cloud Run, AWS Lambda
- **데이터베이스**: Firebase Firestore (무료)

---

## 📚 참고 자료

- [Firebase 문서](https://firebase.google.com/docs)
- [Express.js 가이드](https://expressjs.com/)
- [Node.js API 문서](https://nodejs.org/api/)
- [BACKEND_API_GUIDE.md](BACKEND_API_GUIDE.md)
- [README.md](README.md)

---

## 📞 지원

문제 발생 시:

1. 서버 로그 확인: `tail -f backend/server.log`
2. 헬스 체크: `curl http://localhost:3000/api/health`
3. 브라우저 콘솔 확인 (F12 → Console)
4. Firestore 콘솔 확인: https://console.firebase.google.com

---

**마지막 업데이트**: 2026-01-13
