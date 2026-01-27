/**
 * 전투룸 UI 모듈
 * 실시간 전투 상태 표시 및 액션 제어
 */

class BattleRoom {
  constructor(battleId, apiBaseUrl = null) {
    this.battleId = battleId;
    this.apiBaseUrl = apiBaseUrl || (window.CONFIG?.API_BASE_URL || 'http://localhost:3000/api');
    this.battle = null;
    this.currentPlayer = null;
    this.pollInterval = null;
    this.POLL_INTERVAL = 1000; // 1초마다 상태 조회
    this.errorCount = 0; // 연속 에러 카운트
    this.MAX_ERRORS = 5; // 최대 연속 에러 허용
    this.lastErrorMessage = null;
    this.profilesModalAutoOpened = false;

    this.init();
  }

  getCopyGuideText() {
    // 사용자가 원하는 "안내 문구"를 여기에 넣거나, window.CONFIG로 주입할 수 있습니다.
    // 예: window.CONFIG.BATTLE_COPY_GUIDE_TEXT = '...';
    return String(window.CONFIG?.BATTLE_COPY_GUIDE_TEXT || '');
  }

  formatMentionName(name) {
    const raw = String(name ?? '').trim();
    if (!raw) return '@?';
    const firstToken = raw.split(/\s+/)[0];
    const clean = firstToken.replace(/^@+/, '');
    return `@${clean || '?'}`;
  }

  formatStat(statValue) {
    const value = Number(statValue);
    const clamped = Number.isFinite(value) ? Math.min(5, Math.max(1, Math.round(value))) : 1;
    const diamonds = '◆'.repeat(clamped);
    const score = 50 + (clamped - 1) * 5;
    return { diamonds, score };
  }

  getProfilesText({ teamIndex = null } = {}) {
    if (!this.battle?.participants?.length) return '';

    const teams = this.groupByTeam(this.battle.participants);
    const teamNumbers = Object.keys(teams)
      .map(n => parseInt(n, 10))
      .filter(n => Number.isFinite(n))
      .sort((a, b) => a - b);

    const renderTeam = (teamNo) => {
      const participants = (teams[teamNo] || [])
        .slice()
        .sort((a, b) => (a.initiativeOrder ?? 0) - (b.initiativeOrder ?? 0));

      const blocks = participants.map(p => {
        const c = p.character || {};
        const mention = this.formatMentionName(c.name);
        const atk = this.formatStat(c.atk);
        const agi = this.formatStat(c.agi);
        const def = this.formatStat(c.def);
        const skill = this.formatStat(c.skillStat);

        return [
          mention,
          `공격: ${atk.diamonds} (${atk.score})`,
          `민첩: ${agi.diamonds} (${agi.score})`,
          `방어: ${def.diamonds} (${def.score})`,
          `스킬: ${skill.diamonds} (${skill.score})`,
        ].join('\n');
      });

      if (blocks.length === 0) return '';
      const header = `[팀 ${teamNo}]`;
      return [header, ...blocks].join('\n\n');
    };

    if (teamIndex !== null && teamIndex !== undefined) {
      return renderTeam(Number(teamIndex)).trim();
    }

    return teamNumbers
      .map(t => renderTeam(t))
      .filter(Boolean)
      .join('\n\n')
      .trim();
  }

  getCopyPayload({ teamIndex = null } = {}) {
    const guide = this.getCopyGuideText();
    const profiles = this.getProfilesText({ teamIndex });
    return [guide, profiles].filter((s) => String(s || '').trim()).join('\n\n');
  }

  setProfilesModalText(text) {
    const textarea = document.getElementById('profiles-modal-text');
    if (textarea) textarea.value = String(text ?? '');
  }

  openProfilesModal(text) {
    this.setProfilesModalText(text);
    const modal = document.getElementById('profiles-modal');
    if (modal) modal.style.display = 'block';
  }

  closeProfilesModal() {
    const modal = document.getElementById('profiles-modal');
    if (modal) modal.style.display = 'none';
  }

  async copyTextToClipboard(text) {
    const payload = String(text ?? '');
    if (!payload.trim()) return false;

    try {
      await navigator.clipboard.writeText(payload);
      return true;
    } catch (error) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = payload;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        return ok;
      } catch (fallbackError) {
        console.error('[BattleRoom] copy failed:', error, fallbackError);
        return false;
      }
    }
  }

  getUi() {
    return window.app;
  }

  async uiAlert(message, title = '알림') {
    const ui = this.getUi();
    if (ui?.showAlert) return ui.showAlert({ title, message });
    console.warn('[BattleRoom] UI alert fallback:', title, message);
  }

  async uiConfirm(message, title = '확인', okText = '확인', cancelText = '취소') {
    const ui = this.getUi();
    if (ui?.showConfirm) return ui.showConfirm({ title, message, okText, cancelText });
    console.warn('[BattleRoom] UI confirm fallback:', title, message);
    return false;
  }

  async uiNumberPrompt(message, { title = '입력', initialValue = 1, min = 1, max = 9999, okText = '적용', cancelText = '취소' } = {}) {
    const ui = this.getUi();
    if (ui?.showNumberPrompt) {
      return ui.showNumberPrompt({ title, message, initialValue, min, max, okText, cancelText });
    }
    console.warn('[BattleRoom] UI number prompt fallback:', title, message);
    return null;
  }

  async init() {
    // 초기 전투 데이터 로드
    await this.fetchBattle();
    this.render();
    this.autoOpenProfilesModalOnce();
    this.startPolling();
  }

  autoOpenProfilesModalOnce() {
    if (this.profilesModalAutoOpened) return;
    this.profilesModalAutoOpened = true;
    try {
      this.openProfilesModal(this.getCopyPayload());
    } catch (e) {
      console.warn('[BattleRoom] auto open profiles modal failed:', e);
    }
  }

  /**
   * 서버에서 전투 데이터 조회
   */
  async fetchBattle() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/battles/${this.battleId}`);
      if (!response.ok) throw new Error('전투 데이터 조회 실패');

      this.battle = await response.json();
      this.errorCount = 0; // 성공 시 에러 카운트 리셋
      this.lastErrorMessage = null;
      
      // 전투 종료 감지
      if (this.battle.status === 'FINISHED') {
        this.stopPolling();
      }
    } catch (error) {
      console.error('❌ 전투 조회 오류:', error);
      this.errorCount++;
      this.lastErrorMessage = error?.message ? String(error.message) : '전투 조회 오류';
      
      // 연속 에러가 너무 많으면 폴링 중지
      if (this.errorCount >= this.MAX_ERRORS) {
        console.error('⚠️ 연속 에러 발생, 폴링 중지');
        this.stopPolling();
        await this.uiAlert('서버 연결에 문제가 발생했습니다. 새로고침해주세요.', '연결 오류');
      }
    }
  }

  /**
   * 주기적 상태 갱신 시작
   */
  startPolling() {
    if (this.pollInterval) return; // 이미 실행 중이면 스킵
    
    this.pollInterval = setInterval(async () => {
      await this.fetchBattle();
      this.render();
    }, this.POLL_INTERVAL);
  }

  /**
   * 주기적 상태 갱신 중지
   */
  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * UI 렌더링
   */
  render() {
    const container = document.getElementById('battle-room-container');
    if (!container) return;

    container.innerHTML = this.getHTML();
    this.attachEventListeners();
    this.scrollBattleLogToBottom();
  }

  /**
   * 메인 HTML 반환
   */
  getHTML() {
    // 전투 데이터가 아직 없을 때도(로딩/오류) 화면 골격은 보여줌
    if (!this.battle) {
      const msg = this.lastErrorMessage
        ? `전투 데이터를 불러오지 못했습니다: ${this.escapeHtml(this.lastErrorMessage)}`
        : '전투 데이터를 불러오는 중입니다...';

      return `
        <div class="battle-room">
          <div class="battle-header">
            <div class="battle-info">
              <h2>전투 정보</h2>
              <p class="battle-details">
                <span class="badge badge-status">로딩/오류</span>
              </p>
            </div>
            <div class="battle-actions">
              <button id="btn-exit" class="btn btn-secondary">나가기</button>
            </div>
          </div>

          <div class="battle-profiles-section">
            <div class="profiles-header">
              <h3>📋 캐릭터 프로필 (복붙용)</h3>
              <div class="profiles-actions">
                <button id="btn-copy-profiles" class="btn btn-secondary">전체 복사</button>
                <button id="btn-copy-team-1" class="btn btn-secondary">팀 1 복사</button>
                <button id="btn-copy-team-2" class="btn btn-secondary">팀 2 복사</button>
                <button id="btn-open-profiles-modal" class="btn btn-secondary">미리보기</button>
              </div>
            </div>
            <div class="profiles-hint">${msg}</div>
          </div>

          <div id="profiles-modal" class="modal centered" style="display:none;">
            <div class="modal-content" style="max-width:720px; width: calc(100% - 32px);">
              <div class="modal-header">
                <h2>복붙용 텍스트</h2>
                <button id="profiles-modal-close" class="modal-close" aria-label="닫기">&times;</button>
              </div>
              <div class="modal-body">
                <textarea id="profiles-modal-text" class="profiles-text" readonly></textarea>
                <div class="profiles-modal-actions">
                  <button id="profiles-modal-copy" class="btn btn-primary">복사</button>
                  <button id="profiles-modal-ok" class="btn btn-secondary">닫기</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    const {
      id,
      status,
      phase,
      turnNo,
      participants,
      turnOwnerParticipantId
    } = this.battle;

    // 참가자를 팀별로 분류
    const teams = this.groupByTeam(participants);

    return `
      <div class="battle-room">
        <!-- 헤더: 전투 정보 -->
        <div class="battle-header">
          <div class="battle-info">
            <h2>전투 중...</h2>
            <p class="battle-details">
              <span class="badge badge-turn">📍 ${turnNo}턴</span>
              <span class="badge badge-phase">${this.getPhaseLabel(phase)}</span>
              <span class="badge badge-status">${status === 'IN_PROGRESS' ? '진행 중' : '종료'}</span>
            </p>
          </div>
          <div class="battle-actions">
            <button id="btn-timeout" class="btn btn-danger">
              ⏱️ 타임아웃 승리
            </button>
            <button id="btn-exit" class="btn btn-secondary">
              나가기
            </button>
          </div>
        </div>

        <!-- 메인 전투 영역 -->
        <div class="battle-arena">
          ${this.renderTeams(teams, turnOwnerParticipantId)}
        </div>

        <!-- 하단: 액션 패널 -->
        <div class="battle-action-panel">
          ${this.renderActionPanel(turnOwnerParticipantId, participants)}
        </div>

        <!-- 복붙용 캐릭터 프로필 -->
        <div class="battle-profiles-section">
          <div class="profiles-header">
            <h3>📋 캐릭터 프로필 (복붙용)</h3>
            <div class="profiles-actions">
              <button id="btn-copy-profiles" class="btn btn-secondary">전체 복사</button>
              <button id="btn-copy-team-1" class="btn btn-secondary">팀 1 복사</button>
              <button id="btn-copy-team-2" class="btn btn-secondary">팀 2 복사</button>
              <button id="btn-open-profiles-modal" class="btn btn-secondary">미리보기</button>
            </div>
          </div>
          <div class="profiles-hint">※ 안내 문구 + 프로필 텍스트를 모달로 표시합니다.</div>
        </div>

        <!-- 복붙용 모달 -->
        <div id="profiles-modal" class="modal centered" style="display:none;">
          <div class="modal-content" style="max-width:720px; width: calc(100% - 32px);">
            <div class="modal-header">
              <h2>복붙용 텍스트</h2>
              <button id="profiles-modal-close" class="modal-close" aria-label="닫기">&times;</button>
            </div>
            <div class="modal-body">
              <textarea id="profiles-modal-text" class="profiles-text" readonly></textarea>
              <div class="profiles-modal-actions">
                <button id="profiles-modal-copy" class="btn btn-primary">복사</button>
                <button id="profiles-modal-ok" class="btn btn-secondary">닫기</button>
              </div>
            </div>
          </div>
        </div>

        <!-- 전투 로그 -->
        <div class="battle-log-section">
          <h3>⚔️ 전투 로그</h3>
          <div id="battle-log" class="battle-log">
            ${this.renderLogs()}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 참가자를 팀별로 분류
   */
  groupByTeam(participants) {
    const teams = {};
    participants.forEach(p => {
      if (!teams[p.teamIndex]) {
        teams[p.teamIndex] = [];
      }
      teams[p.teamIndex].push(p);
    });
    return teams;
  }

  /**
   * 팀별 렌더링
   */
  renderTeams(teams, turnOwnerParticipantId) {
    const teamNumbers = Object.keys(teams).sort();

    return teamNumbers.map(teamIdx => {
      const participants = teams[teamIdx];
      const isTeam1 = parseInt(teamIdx) === 1;

      return `
        <div class="team-column team-${isTeam1 ? 'left' : 'right'}">
          <h3 class="team-header">${isTeam1 ? '🔴 팀 1' : '🔵 팀 2'}</h3>
          <div class="participants-container">
            ${participants
              .sort((a, b) => a.initiativeOrder - b.initiativeOrder)
              .map(p => this.renderParticipant(p, turnOwnerParticipantId))
              .join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * 개별 참가자 카드
   */
  renderParticipant(participant, turnOwnerParticipantId) {
    const { id, character, hp, startHp, isAlive } = participant;
    const hpPercent = Math.max(0, (hp / startHp) * 100);
    const isCurrentTurn = id === turnOwnerParticipantId;

    return `
      <div class="participant-card ${!isAlive ? 'dead' : ''} ${isCurrentTurn ? 'active-turn' : ''}">
        <div class="card-header">
          <h4 class="participant-name">${character.name}</h4>
          ${isCurrentTurn ? '<span class="turn-indicator">⏱️ 이 턴</span>' : ''}
        </div>

        <div class="card-stats">
          <div class="stat-row">
            <span class="stat-label">HP</span>
            <div class="hp-bar">
              <div class="hp-fill" style="width: ${hpPercent}%; background: ${this.getHPColor(hpPercent)};"></div>
            </div>
            <span class="stat-value">${hp} / ${startHp}</span>
          </div>

          <div class="stat-grid">
            <div class="stat-box">
              <span class="stat-icon">⚔️</span>
              <span class="stat-value">${character.atk}</span>
            </div>
            <div class="stat-box">
              <span class="stat-icon">🛡️</span>
              <span class="stat-value">${character.def}</span>
            </div>
            <div class="stat-box">
              <span class="stat-icon">🏃</span>
              <span class="stat-value">${character.agi}</span>
            </div>
            <div class="stat-box">
              <span class="stat-icon">✨</span>
              <span class="stat-value">${character.skillStat}</span>
            </div>
          </div>
        </div>

        ${!isAlive ? '<div class="status-badge dead-badge">💀 쓰러짐</div>' : ''}
      </div>
    `;
  }

  /**
   * 액션 패널 (턴 주인만 보임)
   */
  renderActionPanel(turnOwnerParticipantId, participants) {
    const isMyTurn = turnOwnerParticipantId !== null;
    const phase = this.battle.phase;

    // 턴 행동 페이즈
    if (phase === 'TURN_ACTION' && isMyTurn) {
      const turnOwner = participants.find(p => p.id === turnOwnerParticipantId);
      if (!turnOwner) return '';

      return `
        <div class="action-panel">
          <p class="panel-title">🎯 ${turnOwner.character.name}의 턴 - 행동을 선택하세요</p>
          <div class="action-buttons">
            <button class="btn btn-attack" data-action="basic-attack">
              ⚔️ 기본 공격
            </button>
            <button class="btn btn-skill" data-action="use-skill">
              ✨ 스킬 사용
            </button>
            <button class="btn btn-item" data-action="use-item">
              🎁 아이템 사용
            </button>
          </div>
        </div>
      `;
    }

    // 방어 응답 페이즈
    if ((phase === 'AWAITING_REACTION' || phase === 'AWAITING_DEFENSE_SKILL') && isMyTurn) {
      const defender = participants.find(p => p.id === turnOwnerParticipantId);
      if (!defender) return '';

      if (phase === 'AWAITING_REACTION') {
        return `
          <div class="action-panel">
            <p class="panel-title">🛡️ ${defender.character.name}에게 공격이 들어왔습니다! 응답하세요</p>
            <div class="action-buttons">
              <button class="btn btn-dodge" data-action="dodge">
                💨 회피
              </button>
              <button class="btn btn-counter" data-action="counter">
                ⚔️ 반격
              </button>
              <button class="btn btn-pass" data-action="pass">
                ✋ 패스
              </button>
            </div>
          </div>
        `;
      }

      if (phase === 'AWAITING_DEFENSE_SKILL') {
        return `
          <div class="action-panel">
            <p class="panel-title">🛡️ 방어 스킬로 대응하세요</p>
            <div class="action-buttons">
              <button class="btn btn-defense" data-action="defense-skill">
                🛡️ 방어 스킬
              </button>
              <button class="btn btn-pass" data-action="pass">
                ✋ 패스
              </button>
            </div>
          </div>
        `;
      }
    }

    return `<p style="text-align: center; color: #999;">대기 중...</p>`;
  }

  /**
   * 전투 로그 렌더링 (최근 10개)
   */
  renderLogs() {
    if (!this.battle.logs || this.battle.logs.length === 0) {
      return '<p style="color: #999;">로그가 없습니다</p>';
    }

    const recent = this.battle.logs.slice(-20); // 최근 20개
    return recent
      .map(log => {
        const payload = log?.payload || {};
        const actorId = payload.actor;
        const defenderId = payload.defender;
        const participant = this.battle.participants.find(p => p.id === actorId || p.id === defenderId);
        const name = participant?.character?.name || '?';
        const typeClass = String(log?.type || 'UNKNOWN').toLowerCase();

        return `
          <div class="log-entry log-${this.escapeHtml(typeClass)}">
            <span class="log-turn">[${this.escapeHtml(log?.turnNo)}턴]</span>
            <span class="log-text">${this.escapeHtml(this.getLogText(log, name))}</span>
          </div>
        `;
      })
      .join('');
  }

  scrollBattleLogToBottom() {
    const el = document.getElementById('battle-log');
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }

  escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * 로그 텍스트 생성
   */
  getLogText(log, name) {
    const { type, payload } = log;

    if (type === 'ACTION') {
      const action = payload.action;
      if (action === 'BASIC_ATTACK') return `${name}이(가) 기본 공격을 시전했습니다!`;
      if (action === 'USE_SKILL') return `${name}이(가) 스킬을 사용했습니다!`;
      if (action === 'USE_ITEM') return `${name}이(가) 아이템을 사용했습니다!`;
    }

    if (type === 'RESPONSE') {
      const response = payload.response;
      if (response === 'DODGE') return `${name}이(가) 회피했습니다!`;
      if (response === 'COUNTER') return `${name}이(가) 반격했습니다!`;
      if (response === 'DEFENSE_SKILL') return `${name}이(가) 방어 스킬을 사용했습니다!`;
      if (response === 'PASS') return `${name}이(가) 공격을 받았습니다...`;
    }

    if (type === 'END') {
      return '전투가 종료되었습니다!';
    }

    return '알 수 없는 이벤트';
  }

  /**
   * 페이즈 라벨
   */
  getPhaseLabel(phase) {
    const labels = {
      TURN_ACTION: '🎯 행동 선택',
      AWAITING_REACTION: '🛡️ 반응 대기',
      AWAITING_DEFENSE_SKILL: '🛡️ 방어 스킬',
      FINISHED: '✅ 종료'
    };
    return labels[phase] || phase;
  }

  /**
   * HP 색상
   */
  getHPColor(percent) {
    const p = Number(percent) || 0;
    if (p <= 10) return '#ef4444'; // 빨강
    if (p <= 25) return '#fb923c'; // 주황
    if (p <= 50) return '#facc15'; // 노랑
    return '#22c55e'; // 초록
  }

  /**
   * 이벤트 리스너 연결
   */
  attachEventListeners() {
    // 타임아웃 버튼
    document.getElementById('btn-timeout')?.addEventListener('click', () => this.requestTimeout());
    
    // 나가기 버튼
    document.getElementById('btn-exit')?.addEventListener('click', () => this.exitBattle());

    // 액션 버튼들
    document.querySelectorAll('.action-buttons .btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.action;
        this.handleAction(action);
      });
    });

    document.getElementById('btn-copy-profiles')?.addEventListener('click', async () => {
      const payload = this.getCopyPayload();
      this.openProfilesModal(payload);
    });

    document.getElementById('btn-copy-team-1')?.addEventListener('click', async () => {
      const payload = this.getCopyPayload({ teamIndex: 1 });
      this.openProfilesModal(payload);
    });

    document.getElementById('btn-copy-team-2')?.addEventListener('click', async () => {
      const payload = this.getCopyPayload({ teamIndex: 2 });
      this.openProfilesModal(payload);
    });

    document.getElementById('btn-open-profiles-modal')?.addEventListener('click', () => {
      this.openProfilesModal(this.getCopyPayload());
    });

    // 모달 닫기
    const close = () => this.closeProfilesModal();
    document.getElementById('profiles-modal-close')?.addEventListener('click', close);
    document.getElementById('profiles-modal-ok')?.addEventListener('click', close);
    document.getElementById('profiles-modal')?.addEventListener('click', (e) => {
      if (e.target?.id === 'profiles-modal') close();
    });

    // 모달 복사
    document.getElementById('profiles-modal-copy')?.addEventListener('click', async () => {
      const text = document.getElementById('profiles-modal-text')?.value || '';
      const ok = await this.copyTextToClipboard(text);
      if (ok) await this.uiAlert('클립보드에 복사되었습니다.', '복사 완료');
      else await this.uiAlert('복사에 실패했습니다.', '오류');
    });
  }

  /**
   * 액션 처리
   */
  async handleAction(action) {
    if (!this.battle) return;

    const turnOwner = this.battle.participants.find(
      p => p.id === this.battle.turnOwnerParticipantId
    );

    if (!turnOwner) return;

    try {
      if (action === 'basic-attack') {
        await this.basicAttack(turnOwner.id);
      } else if (action === 'use-skill') {
        await this.showSkillSelection(turnOwner.id);
      } else if (action === 'use-item') {
        await this.showItemSelection(turnOwner.id);
      } else if (action === 'dodge') {
        await this.respond('DODGE', turnOwner.id);
      } else if (action === 'counter') {
        await this.respond('COUNTER', turnOwner.id);
      } else if (action === 'defense-skill') {
        await this.showDefenseSkillSelection(turnOwner.id);
      } else if (action === 'pass') {
        await this.respond('PASS', turnOwner.id);
      }
    } catch (error) {
      console.error('❌ 액션 실행 오류:', error);
      await this.uiAlert('액션 실행에 실패했습니다: ' + error.message, '오류');
    }
  }

  /**
   * 기본 공격
   */
  async basicAttack(attackerId) {
    try {
      // 대상 선택 팝업 (간단 버전)
      const targetId = await this.uiNumberPrompt('대상 ID를 입력하세요:', {
        title: '대상 선택',
        initialValue: 1,
        min: 1,
        max: 9999,
        okText: '선택',
        cancelText: '취소'
      });
      if (targetId === null) return;

      const response = await fetch(`${this.apiBaseUrl}/battles/${this.battleId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'BASIC_ATTACK',
          participantId: attackerId,
          targetParticipantId: String(targetId)
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '공격 실패');
      }

      await this.fetchBattle();
      this.render();
    } catch (error) {
      console.error('❌ 공격 오류:', error);
      await this.uiAlert('공격 실패: ' + error.message, '오류');
    }
  }

  /**
   * 스킬 선택 (준비 중)
   */
  async showSkillSelection(actorId) {
    await this.uiAlert('스킬 선택 팝업 (준비 중)');
  }

  /**
   * 아이템 선택 (준비 중)
   */
  async showItemSelection(actorId) {
    await this.uiAlert('아이템 선택 팝업 (준비 중)');
  }

  /**
   * 방어 스킬 선택 (준비 중)
   */
  async showDefenseSkillSelection(defenderId) {
    await this.uiAlert('방어 스킬 선택 팝업 (준비 중)');
  }

  /**
   * 응답 전송
   */
  async respond(response, participantId) {
    try {
      const responseData = {
        response,
        participantId
      };

      if (response === 'DEFENSE_SKILL') {
        const skillId = await this.uiNumberPrompt('방어 스킬 ID:', {
          title: '방어 스킬',
          initialValue: 1,
          min: 1,
          max: 9999,
          okText: '선택',
          cancelText: '취소'
        });
        if (skillId === null) return;
        responseData.skillId = String(skillId);
      }

      const res = await fetch(`${this.apiBaseUrl}/battles/${this.battleId}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(responseData)
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || '응답 전송 실패');
      }

      await this.fetchBattle();
      this.render();
    } catch (error) {
      console.error('❌ 응답 오류:', error);
      await this.uiAlert('응답 실패: ' + error.message, '오류');
    }
  }

  /**
   * 타임아웃 요청
   */
  async requestTimeout() {
    try {
      const ok = await this.uiConfirm(
        '정말 타임아웃으로 전투를 종료하시겠습니까?',
        '타임아웃 종료',
        '종료',
        '취소'
      );
      if (!ok) return;

      const response = await fetch(`${this.apiBaseUrl}/battles/${this.battleId}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endReason: 'TIMEOUT' })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '타임아웃 요청 실패');
      }

      await this.fetchBattle();
      this.render();
      this.stopPolling();
      
      await this.uiAlert('전투가 타임아웃으로 종료되었습니다.', '안내');
    } catch (error) {
      console.error('❌ 타임아웃 오류:', error);
      await this.uiAlert('타임아웃 요청 실패: ' + error.message, '오류');
    }
  }

  /**
   * 전투 나가기
   */
  async exitBattle() {
    const ok = await this.uiConfirm('전투를 나가시겠습니까?', '전투 나가기', '나가기', '취소');
    if (!ok) return;
    this.stopPolling();
    window.location.href = '/';
  }

  /**
   * 결과 화면 표시
   */
  showResults(result) {
    const container = document.getElementById('battle-room-container');
    if (!container) return;

    const { winner, scores } = result;

    container.innerHTML = `
      <div class="battle-results">
        <h1>${winner === 1 ? '🔴 팀 1' : '🔵 팀 2'} 승리!</h1>
        <div class="scores">
          ${Object.entries(scores)
            .map(([teamIdx, score]) => `
              <div class="score-item">
                <span>${teamIdx === '1' ? '🔴 팀 1' : '🔵 팀 2'}</span>
                <span class="score-value">${(score * 100).toFixed(1)}%</span>
              </div>
            `)
            .join('')}
        </div>
        <button onclick="window.location.href='/';" class="btn btn-primary">
          메인으로 돌아가기
        </button>
      </div>
    `;
  }
}

// 모듈 내보내기
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BattleRoom;
}
