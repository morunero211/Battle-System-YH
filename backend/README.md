# ⚔️ 양호후환 전투 시스템 - 백엔드 API

Node.js + Express 기반 REST API 서버

## 📦 설치

```bash
cd backend
npm install
```

## 🚀 실행

### 개발 모드 (nodemon - 자동 재시작)
```bash
npm run dev
```

### 프로덕션 모드
```bash
npm start
```

## 📡 API 엔드포인트

### 🔐 인증 (`/api/auth`)

#### 회원가입
```
POST /api/auth/signup
Body: { email, password, username }
Response: { token, user }
```

#### 로그인
```
POST /api/auth/login
Body: { email, password }
Response: { token, user }
```

#### 사용자 정보 조회
```
GET /api/auth/me
Headers: Authorization: Bearer <token>
Response: { user }
```

### 👥 캐릭터 (`/api/characters`)

#### 전체 캐릭터 조회
```
GET /api/characters
Response: { characters, total }
```

#### 캐릭터 생성
```
POST /api/characters
Body: { name, hp, attack, defense, agility, skill, skillTypes, team }
Response: { character }
```

#### 특정 캐릭터 조회
```
GET /api/characters/:id
Response: { character }
```

#### 캐릭터 수정
```
PUT /api/characters/:id
Body: { name, hp, ... }
Response: { character }
```

#### 캐릭터 삭제
```
DELETE /api/characters/:id
Response: { message }
```

### ⚔️ 전투 (`/api/battles`)

#### 전투 시뮬레이션
```
POST /api/battles/simulate
Body: {
  attacker: { name, attack, skill, ... },
  defender: { name, hp, defense, agility, ... }
}
Response: {
  success: true/false,
  result: 'hit' | 'critical' | 'dodge' | 'miss',
  damage: number,
  log: string[],
  defenderHp: number
}
```

#### 전투 기록 저장
```
POST /api/battles/record
Body: { teams, winner, log, duration }
Response: { battle }
```

#### 전투 기록 조회
```
GET /api/battles/history?limit=10
Response: { battles, total }
```

## 🧪 테스트

### Health Check
```bash
curl http://localhost:3000/api/health
```

### 회원가입 테스트
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"123456"}'
```

### 전투 시뮬레이션 테스트
```bash
curl -X POST http://localhost:3000/api/battles/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "attacker": {"name":"김철수","attack":5,"skill":4},
    "defender": {"name":"이영희","hp":100,"defense":3,"agility":4}
  }'
```

## 📁 프로젝트 구조

```
backend/
├── src/
│   ├── server.js          # 메인 서버
│   ├── routes/            # API 라우트
│   │   ├── auth.js        # 인증 API
│   │   ├── characters.js  # 캐릭터 API
│   │   └── battles.js     # 전투 API
│   ├── controllers/       # 비즈니스 로직 (추후)
│   ├── models/            # 데이터 모델 (추후)
│   ├── middleware/        # 미들웨어 (추후)
│   └── config/            # 설정 파일 (추후)
├── package.json
├── .env                   # 환경 변수
└── README.md
```

## 🔧 환경 변수

`.env` 파일 설정:

```env
PORT=3000
NODE_ENV=development
JWT_SECRET=your-secret-key
JWT_EXPIRE=7d
CORS_ORIGIN=http://localhost:8000
```

## 🚀 다음 단계

1. **MongoDB 연동** - 실제 데이터베이스 연결
2. **JWT 미들웨어** - 인증 보호
3. **입력 유효성 검사** - express-validator 활용
4. **에러 핸들링** - 통합 에러 처리
5. **로깅 시스템** - winston/morgan
6. **테스트 코드** - Jest/Mocha

## 📝 노트

- 현재는 메모리 기반 저장소 사용 (서버 재시작 시 데이터 소실)
- 프로덕션 배포 전 MongoDB/PostgreSQL 연동 필요
- JWT 시크릿 키는 반드시 변경할 것
