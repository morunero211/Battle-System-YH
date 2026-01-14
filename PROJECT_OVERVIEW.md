# 🎮 양호후환 전투 시스템 - 풀스택 프로젝트

Firebase + 커스텀 백엔드 하이브리드 아키텍처

## 📊 프로젝트 구조

```
Battle-System-YH/
├── 📁 frontend/               # 프론트엔드 (HTML/CSS/JS)
│   ├── index.html
│   ├── css/
│   ├── js/
│   └── data/
│
├── 📁 backend/                # 백엔드 API 서버 (Node.js/Express)
│   ├── src/
│   │   ├── server.js         # 메인 서버
│   │   └── routes/           # API 라우트
│   ├── package.json
│   └── README.md
│
└── 📄 README.md (이 파일)
```

## 🚀 실행 방법

### 1️⃣ 백엔드 서버 실행

```bash
cd backend
npm install
npm start
```

**서버 주소:** http://localhost:3000

### 2️⃣ 프론트엔드 실행

```bash
# 프로젝트 루트에서
python3 -m http.server 8000
```

**프론트엔드 주소:** http://localhost:8000

### 3️⃣ 브라우저에서 접속

http://localhost:8000 → 전투 시스템 시작!

## 🏗️ 아키텍처

### **하이브리드 아키텍처**

```
프론트엔드 (Port 8000)
    ↓
    ├─→ Firebase Auth (인증)
    ├─→ Firebase Firestore (데이터 저장)
    └─→ 백엔드 API (Port 3000) (전투 로직, 추가 기능)
```

### **역할 분담**

| 컴포넌트 | 역할 | 기술 스택 |
|---------|------|-----------|
| **프론트엔드** | UI, 사용자 인터랙션 | HTML5, CSS3, Vanilla JS |
| **Firebase** | 인증, 기본 데이터 저장 | Firebase Auth, Firestore |
| **백엔드 API** | 전투 시뮬레이션, 복잡한 로직 | Node.js, Express |

## 📡 API 엔드포인트

### 🔐 인증 (`/api/auth`)
- `POST /api/auth/signup` - 회원가입
- `POST /api/auth/login` - 로그인
- `GET /api/auth/me` - 사용자 정보

### 👥 캐릭터 (`/api/characters`)
- `GET /api/characters` - 전체 조회
- `POST /api/characters` - 생성
- `GET /api/characters/:id` - 단일 조회
- `PUT /api/characters/:id` - 수정
- `DELETE /api/characters/:id` - 삭제

### ⚔️ 전투 (`/api/battles`)
- `POST /api/battles/simulate` - 전투 시뮬레이션 (서버에서 처리)
- `POST /api/battles/record` - 전투 기록 저장
- `GET /api/battles/history` - 전투 기록 조회

## 🧪 API 테스트

### Health Check
```bash
curl http://localhost:3000/api/health
```

### 회원가입
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"123456"}'
```

### 전투 시뮬레이션
```bash
curl -X POST http://localhost:3000/api/battles/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "attacker": {"name":"김철수","attack":5,"skill":4},
    "defender": {"name":"이영희","hp":100,"defense":3,"agility":4}
  }'
```

## 🎯 주요 기능

### ✅ 구현 완료
- ✅ Firebase 인증 (이메일/Google)
- ✅ d100 전투 시스템 (프론트 + 백엔드)
- ✅ 캐릭터 CRUD API
- ✅ 전투 시뮬레이션 API
- ✅ 실시간 전투 로그
- ✅ 전투 기록 저장

### 🚧 개발 예정
- MongoDB 연동
- JWT 인증 미들웨어
- WebSocket 실시간 대전
- AI 캐릭터 (Python 연동)
- 리더보드/랭킹 시스템

## 💡 왜 하이브리드 아키텍처?

### Firebase 사용 (장점)
- ✅ 빠른 인증 구현
- ✅ 실시간 데이터 동기화
- ✅ 무료 호스팅

### 커스텀 백엔드 사용 (장점)
- ✅ 복잡한 전투 로직 서버 처리
- ✅ 치트 방지 (로직 숨김)
- ✅ 확장성 (AI, ML 통합 가능)
- ✅ 완전한 제어권

## 🔧 환경 설정

### 백엔드 `.env` 파일
```env
PORT=3000
NODE_ENV=development
JWT_SECRET=your-secret-key
JWT_EXPIRE=7d
CORS_ORIGIN=http://localhost:8000
```

### Firebase 설정
`js/firebase-config.js` 파일 수정 필요

## 📦 의존성

### 백엔드
```json
{
  "express": "^4.18.2",
  "cors": "^2.8.5",
  "bcryptjs": "^2.4.3",
  "jsonwebtoken": "^9.0.2"
}
```

### 프론트엔드
- Firebase SDK (CDN)
- Vanilla JavaScript

## 🚀 배포

### 백엔드 배포 옵션
- Heroku
- AWS EC2
- Google Cloud Run
- Railway

### 프론트엔드 배포
- Firebase Hosting
- Vercel
- Netlify

## 📝 개발 로그

- 2026-01-13: 프로젝트 초기 구축
- 2026-01-13: Firebase 인증 통합
- 2026-01-13: 백엔드 API 서버 구축 ✨

## 🤝 기여

문의사항이나 버그는 Issues에 등록해주세요!

---

**Made by Marunero** ⚔️
