/**
 * Vercel Serverless Function - Main API Entry Point
 * 양호후환 전투 시스템 백엔드
 */

const express = require('express');
const cors = require('cors');

// Express 앱 생성
const app = express();

// 미들웨어
app.use(cors({
    origin: [
        'https://battle-system-yh.vercel.app',
        'http://localhost:8000',
        'http://127.0.0.1:8000'
    ],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 로깅 미들웨어
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Routes
const battleRoutes = require('../backend/src/routes/battles');
const dataRoutes = require('../backend/src/routes/data');

app.use('/api/battles', battleRoutes);
app.use('/api/data', dataRoutes);

// 편의상 루트 경로에도 라우트 연결
app.use('/api/characters', dataRoutes);
app.use('/api/skills', dataRoutes);
app.use('/api/items', dataRoutes);
app.use('/api/rulesets', dataRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: '양호후환 전투 시스템 API 서버 (Vercel Serverless)',
        firebase: 'Testing Mode',
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

// Vercel Serverless Function Export
module.exports = app;
