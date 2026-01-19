/**
 * 양호후환 전투 시스템 - 백엔드 서버 (Firebase 연동)
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// 환경 변수 로드
dotenv.config();
// 로컬 환경 변수도 로드 (개발용)
if (process.env.NODE_ENV !== 'production') {
    dotenv.config({ path: path.join(__dirname, '../.env.local') });
}

// Firebase 초기화
const { admin, db, firebaseInitialized } = require('./config/firebase');

// Express 앱 생성
const app = express();

// 미들웨어
const corsOriginsEnv = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '').trim();
const explicitOrigins = corsOriginsEnv
    ? corsOriginsEnv.split(',').map(s => s.trim()).filter(Boolean)
    : [];

const corsOptions = {
    origin: (origin, callback) => {
        // same-origin / server-to-server 요청(Origin 없음)은 허용
        if (!origin) return callback(null, true);

        // 명시적 allowlist가 있으면 그것만 허용
        if (explicitOrigins.length > 0) {
            return callback(null, explicitOrigins.includes(origin));
        }

        // 개발/배포 편의: Vercel 프리뷰 도메인과 로컬 개발 도메인은 허용
        try {
            const url = new URL(origin);
            const host = url.hostname;
            const isLocalhost = host === 'localhost' || host === '127.0.0.1';
            const isVercelPreview = host.endsWith('.vercel.app');
            return callback(null, isLocalhost || isVercelPreview);
        } catch {
            return callback(null, false);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 로깅 미들웨어
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Routes
const battleRoutes = require('./routes/battles');
const dataRoutes = require('./routes/data');
const firebaseRoutes = require('./routes/firebase');

app.use('/api/battles', battleRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/firebase', firebaseRoutes);

// 편의상 루트 경로에도 라우트 연결
app.use('/api/characters', dataRoutes);
app.use('/api/skills', dataRoutes);
app.use('/api/items', dataRoutes);
app.use('/api/rulesets', dataRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: '양호후환 전투 시스템 API 서버',
        firebase: firebaseInitialized ? '✅ 연동됨' : '⚠️ 미연동 (메모리 폴백)',
        timestamp: new Date().toISOString()
    });
});

// 404 핸들러
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `경로를 찾을 수 없습니다: ${req.path}`
    });
});

// 에러 핸들러
app.use((err, req, res, next) => {
    console.error('서버 에러:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// 서버 시작
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log('⚔️  양호후환 전투 시스템 API 서버');
    console.log('='.repeat(50));
    console.log(`🚀 서버 실행: http://localhost:${PORT}`);
    console.log(`📊 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`🌍 환경: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 CORS: ${explicitOrigins.length > 0 ? explicitOrigins.join(', ') : 'localhost + *.vercel.app 허용'}`);
    console.log(`🔥 Firebase: ${db ? '연동됨 ✅' : '미연동 ⚠️'}`);
    console.log('='.repeat(50));
});

module.exports = app;
