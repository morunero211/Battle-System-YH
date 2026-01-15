/**
 * GET /api/health
 * Health check endpoint
 */

module.exports = function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  
  res.status(200).json({
    status: 'ok',
    message: '양호후환 전투 시스템 API 서버 (Vercel Serverless)',
    firebase: 'Testing Mode',
    timestamp: new Date().toISOString()
  });
}
