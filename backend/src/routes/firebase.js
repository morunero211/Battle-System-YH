const express = require('express');
const { admin, db, firebaseInitialized } = require('../config/firebase');

const router = express.Router();

/**
 * GET /api/firebase/health
 * Firebase Admin/Firestore 접근 가능 여부(읽기-only)를 확인합니다.
 */
router.get('/health', async (req, res) => {
  if (!firebaseInitialized || !db) {
    return res.status(501).json({
      status: 'disabled',
      message: 'Firebase 서비스 계정 키가 없어 Firebase/Firestore 기능이 비활성화되어 있습니다.',
      hint: 'backend/serviceAccountKey.json을 추가하거나 FIREBASE_SERVICE_ACCOUNT_PATH 환경 변수를 설정한 뒤 서버를 재시작하세요.'
    });
  }

  const startedAt = Date.now();
  try {
    // 읽기-only ping: 문서가 없어도 네트워크/인증이 정상이라면 get() 자체는 성공합니다.
    const snap = await db.collection('_health').doc('ping').get();
    const latencyMs = Date.now() - startedAt;

    const app = admin.app();
    const projectId = app?.options?.projectId || null;

    return res.json({
      status: 'ok',
      firebaseAdmin: true,
      projectId,
      firestore: {
        reachable: true,
        latencyMs,
        pingDocExists: snap.exists
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    return res.status(500).json({
      status: 'error',
      firebaseAdmin: true,
      firestore: {
        reachable: false,
        latencyMs
      },
      error: {
        message: error?.message || String(error),
        code: error?.code
      },
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
