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

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        message: '양호후환 전투 시스템 API 서버 (Vercel Serverless)',
        firebase: 'Testing Mode',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: '양호후환 전투 시스템 API 서버 (Vercel Serverless)',
        firebase: 'Testing Mode',
        timestamp: new Date().toISOString()
    });
});

// 전투 시뮬레이션 API 스텁
app.post('/api/battles/simulate', (req, res) => {
    try {
        const { team1, team2, terrain } = req.body;
        
        // 간단한 승리 로직: 팀1 합계 > 팀2 합계면 팀1 승리
        const team1Total = (team1 || []).reduce((sum, char) => sum + (char.stats?.hp || 0), 0);
        const team2Total = (team2 || []).reduce((sum, char) => sum + (char.stats?.hp || 0), 0);
        const winner = team1Total > team2Total ? 1 : 2;
        
        res.json({
            success: true,
            winner,
            scores: {
                1: team1Total,
                2: team2Total
            },
            message: `팀 ${winner} 승리!`
        });
    } catch (error) {
        res.status(400).json({
            error: '전투 시뮬레이션 실패',
            message: error.message
        });
    }
});

// 나머지 API 라우트도 추가 (임시 응답)
app.get('/api/battles/:id', (req, res) => {
    res.json({ success: true, message: 'Battle not found' });
});

app.get('/api/characters', (req, res) => {
    res.json({ success: true, characters: [] });
});

app.post('/api/battles', (req, res) => {
    res.json({ success: true, battleId: 'test-battle-' + Date.now() });
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
