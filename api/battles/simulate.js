/**
 * POST /api/battles/simulate
 * 전투 시뮬레이션
 */

export default function handler(req, res) {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { team1, team2, terrain } = req.body;
    
    // 간단한 승리 로직
    const team1Total = (team1 || []).reduce((sum, char) => sum + (char.stats?.hp || 0), 0);
    const team2Total = (team2 || []).reduce((sum, char) => sum + (char.stats?.hp || 0), 0);
    const winner = team1Total > team2Total ? 1 : 2;
    
    res.status(200).json({
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
}
