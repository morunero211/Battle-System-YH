/**
 * BattleManager - 전투 생성 및 관리
 */
class BattleManager {
  constructor(apiBaseUrl = null) {
    // API URL: 설정 파일이 제공한 URL 사용, 없으면 기본값 사용
    this.apiBaseUrl = apiBaseUrl || (window.CONFIG?.API_BASE_URL || 'http://localhost:3000/api');
    this.team1Members = [];      // 팀 1 캐릭터 ID 배열
    this.team2Members = [];      // 팀 2 캐릭터 ID 배열
    this.allCharacters = [];     // 모든 캐릭터 데이터
    console.log('BattleManager initialized with API URL:', this.apiBaseUrl);
  }

  /**
   * 캐릭터 목록 조회
   */
  async getCharacters() {
    const response = await fetch(`${this.apiBaseUrl}/data`);
    if (!response.ok) throw new Error('캐릭터 조회 실패');
    return response.json();
  }

  /**
   * RuleSet 목록 조회
   */
  async getRuleSets() {
    const response = await fetch(`${this.apiBaseUrl}/data/rulesets`);
    if (!response.ok) throw new Error('RuleSet 조회 실패');
    return response.json();
  }

  /**
   * 전투 생성
   */
  async createBattle(characterIds, teams, ruleSetId) {
    const response = await fetch(`${this.apiBaseUrl}/battles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        characterIds,
        teams,
        ruleSetId
      })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '전투 생성 실패');
    }
    return response.json();
  }

  /**
   * 전투 진입
   */
  async enterBattle(battleId) {
    const response = await fetch(`${this.apiBaseUrl}/battles/${battleId}`);
    if (!response.ok) throw new Error('전투 조회 실패');
    const battleData = await response.json();
    return new BattleRoom(battleData.id, this.apiBaseUrl);
  }

  /**
   * 전투 생성 폼 렌더링
   */
  renderCreateBattleForm(containerId, preSelectedCharacters = null) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`컨테이너 ${containerId}를 찾을 수 없습니다`);
      return;
    }

    container.innerHTML = `
      <div class="battle-creation-form" style="max-width: 900px; margin: 0 auto; padding: 20px; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h2>⚔️ 새 전투 생성</h2>
        
        <div class="form-section" style="margin-bottom: 20px;">
          <label for="ruleset-select" style="display: block; margin-bottom: 8px; font-weight: bold;">RuleSet 선택:</label>
          <select id="ruleset-select" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            <option value="">-- RuleSet을 선택하세요 --</option>
          </select>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <!-- 팀 1 -->
          <div class="team-section" style="border: 2px solid #4CAF50; border-radius: 8px; padding: 15px; background: #f1f8f4;">
            <h3 style="color: #4CAF50; margin-top: 0;">⚔️ 팀 1 (Hero)</h3>
            
            <div style="display: flex; gap: 8px; margin-bottom: 15px;">
              <select id="team1-character-select" style="flex: 1; padding: 8px; border: 1px solid #4CAF50; border-radius: 4px;">
                <option value="">-- 캐릭터 선택 --</option>
              </select>
              <button id="team1-add-btn" style="padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">추가</button>
            </div>
            
            <div id="team1-members" style="min-height: 100px; background: white; border-radius: 4px; padding: 10px; border: 1px solid #ddd;">
              <p style="color: #999; text-align: center;">팀원이 없습니다</p>
            </div>
          </div>

          <!-- 팀 2 -->
          <div class="team-section" style="border: 2px solid #ff6b6b; border-radius: 8px; padding: 15px; background: #ffe6e6;">
            <h3 style="color: #ff6b6b; margin-top: 0;">⚔️ 팀 2 (Villain/Gov)</h3>
            
            <div style="display: flex; gap: 8px; margin-bottom: 15px;">
              <select id="team2-character-select" style="flex: 1; padding: 8px; border: 1px solid #ff6b6b; border-radius: 4px;">
                <option value="">-- 캐릭터 선택 --</option>
              </select>
              <button id="team2-add-btn" style="padding: 8px 16px; background: #ff6b6b; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">추가</button>
            </div>
            
            <div id="team2-members" style="min-height: 100px; background: white; border-radius: 4px; padding: 10px; border: 1px solid #ddd;">
              <p style="color: #999; text-align: center;">팀원이 없습니다</p>
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 10px; margin-top: 20px; justify-content: center;">
          <button id="create-battle-btn" style="padding: 12px 24px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 16px;">⚔️ 전투 시작</button>
          <button id="cancel-battle-btn" style="padding: 12px 24px; background: #ccc; color: #333; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 16px;">취소</button>
        </div>
      </div>
    `;

    this.setupCreateBattleForm(preSelectedCharacters);
  }

  /**
   * 전투 생성 폼 이벤트 설정
   */
  setupCreateBattleForm(preSelectedCharacters = null) {
    // 클래스 멤버 초기화
    this.team1Members = [];
    this.team2Members = [];

    // 미리 선택된 캐릭터가 있으면 로드
    if (preSelectedCharacters) {
      if (preSelectedCharacters.hero && preSelectedCharacters.hero.length > 0) {
        this.team1Members.push(...preSelectedCharacters.hero.map(id => String(id)));
      }
      if (preSelectedCharacters.villain && preSelectedCharacters.villain.length > 0) {
        this.team2Members.push(...preSelectedCharacters.villain.map(id => String(id)));
      }
      if (preSelectedCharacters.gov && preSelectedCharacters.gov.length > 0) {
        this.team2Members.push(...preSelectedCharacters.gov.map(id => String(id)));
      }
    }

    // RuleSet 로드
    this.getRuleSets().then(ruleSets => {
      const select = document.getElementById('ruleset-select');
      if (select) {
        ruleSets.forEach(rs => {
          const option = document.createElement('option');
          option.value = rs.id;
          option.textContent = rs.name + (rs.isActive ? ' ✓' : '');
          select.appendChild(option);
        });
        if (ruleSets.length > 0) {
          select.value = ruleSets[0].id;
        }
      }
    }).catch(error => {
      console.error('RuleSet 로드 실패:', error);
    });

    // 캐릭터 로드
    this.getCharacters().then(characters => {
      this.allCharacters = characters;

      ['team1-character-select', 'team2-character-select'].forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
          characters.forEach(char => {
            const option = document.createElement('option');
            option.value = char.id;
            option.textContent = `${char.name} (Lv.${char.level || 1})`;
            select.appendChild(option);
          });
        }
      });

      // 미리 선택된 캐릭터 표시
      this.updateMembersList('team1-members', this.team1Members);
      this.updateMembersList('team2-members', this.team2Members);
    }).catch(error => {
      console.error('캐릭터 로드 실패:', error);
      alert('캐릭터를 불러올 수 없습니다: ' + error.message);
    });

    // 팀 1 추가 버튼
    const team1AddBtn = document.getElementById('team1-add-btn');
    if (team1AddBtn) {
      team1AddBtn.addEventListener('click', () => {
        const select = document.getElementById('team1-character-select');
        const charId = select?.value;
        if (charId && !this.team1Members.includes(charId)) {
          this.team1Members.push(charId);
          this.updateMembersList('team1-members', this.team1Members);
          if (select) select.value = '';
        }
      });
    }

    // 팀 2 추가 버튼
    const team2AddBtn = document.getElementById('team2-add-btn');
    if (team2AddBtn) {
      team2AddBtn.addEventListener('click', () => {
        const select = document.getElementById('team2-character-select');
        const charId = select?.value;
        if (charId && !this.team2Members.includes(charId)) {
          this.team2Members.push(charId);
          this.updateMembersList('team2-members', this.team2Members);
          if (select) select.value = '';
        }
      });
    }

    // 전투 생성 버튼
    const createBtn = document.getElementById('create-battle-btn');
    if (createBtn) {
      createBtn.addEventListener('click', async () => {
        const ruleSetId = document.getElementById('ruleset-select')?.value;

        if (!ruleSetId) {
          alert('🎯 RuleSet을 선택해주세요');
          return;
        }

        if (this.team1Members.length === 0 || this.team2Members.length === 0) {
          alert('⚠️ 각 팀에 최소 1명 이상의 캐릭터를 추가해주세요');
          return;
        }

        try {
          const characterIds = [...this.team1Members, ...this.team2Members].map(id => Number(id));
          const teams = [
            ...this.team1Members.map(() => 1),
            ...this.team2Members.map(() => 2)
          ];

          const result = await this.createBattle(characterIds, teams, ruleSetId);
          console.log('✅ 전투 생성 성공:', result);

          // 전투룸으로 진입
          const battleRoom = await this.enterBattle(result.battle.id);

          // 화면 전환
          document.getElementById('battle-screen')?.classList.add('screen-active');
          document.getElementById('character-selection')?.classList.remove('screen-active');

          // 폴링 시작
          battleRoom.startPolling();

          console.log('✅ 전투 시작!');
        } catch (error) {
          alert('⚠️ 전투 생성 실패: ' + error.message);
        }
      });
    }

    // 취소 버튼
    const cancelBtn = document.getElementById('cancel-battle-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        window.location.href = '/';
      });
    }
  }

  /**
   * 팀원 목록 업데이트
   */
  updateMembersList(containerId, memberIds) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (memberIds.length === 0) {
      container.innerHTML = '<p style="color: #999; text-align: center; margin: 0;">팀원이 없습니다</p>';
      return;
    }

    container.innerHTML = memberIds
      .map((charId) => {
        const char = this.allCharacters.find(c => String(c.id) === String(charId));
        if (!char) return '';
        return `
          <div class="member-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f0f0f0; border-radius: 4px; margin-bottom: 8px;">
            <span style="font-weight: 500;">${char.name} (Lv.${char.level || 1})</span>
            <button class="btn-remove" style="background: #ff4444; color: white; border: none; border-radius: 3px; padding: 4px 12px; cursor: pointer; font-weight: bold;" data-id="${charId}">✕</button>
          </div>
        `;
      })
      .join('');

    // 제거 버튼 이벤트 설정
    container.querySelectorAll('.btn-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const charId = e.target.dataset.id;

        if (containerId.includes('team1')) {
          const idx = this.team1Members.indexOf(charId);
          if (idx >= 0) {
            this.team1Members.splice(idx, 1);
            this.updateMembersList('team1-members', this.team1Members);
          }
        } else {
          const idx = this.team2Members.indexOf(charId);
          if (idx >= 0) {
            this.team2Members.splice(idx, 1);
            this.updateMembersList('team2-members', this.team2Members);
          }
        }
      });
    });
  }
}

// 전역 인스턴스 생성
if (typeof window !== 'undefined') {
  window.battleManager = new BattleManager();
}

// Node.js 환경 지원
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BattleManager;
}
