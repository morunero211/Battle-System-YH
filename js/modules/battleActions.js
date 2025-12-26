/**
 * 전투 액션 핸들러 (Battle Actions)
 * 전투 중 플레이어 액션 (공격, 방어, 궁극기) 관리
 */

class BattleActions {
    constructor(app) {
        this.app = app;
        this.selectedTarget = null;
        this.targetSelectionMode = false;
        this.initBattleActionListeners();
    }

    /**
     * 전투 액션 이벤트 리스너 초기화
     */
    initBattleActionListeners() {
        // 공격 버튼
        document.getElementById('action-attack')?.addEventListener('click', () => {
            this.selectTargetForAttack();
        });

        // 방어 버튼
        document.getElementById('action-defend')?.addEventListener('click', () => {
            this.handleDefend();
        });

        // 궁극기 버튼
        document.getElementById('action-ultimate')?.addEventListener('click', () => {
            this.selectTargetForUltimate();
        });

        // 항복 버튼
        document.getElementById('forfeit-button')?.addEventListener('click', () => {
            if (confirm('정말로 항복하시겠습니까?')) {
                this.handleForfeit();
            }
        });

    }

    /**
     * 공격 대상 선택
     */
    selectTargetForAttack() {
        const currentTeamTurn = this.app.battleSystem.currentTeamTurn;
        const teamNames = ['hero', 'gov', 'villain'];
        
        // 적 팀 확인
        const enemyTeams = teamNames.filter((_, idx) => idx !== currentTeamTurn);
        
        this.targetSelectionMode = true;
        this.currentAction = 'attack';
        
        // 적 팀 UI 활성화
        this.enableTargetSelection(enemyTeams);
    }

    /**
     * 궁극기 대상 선택
     */
    selectTargetForUltimate() {
        const currentTeamTurn = this.app.battleSystem.currentTeamTurn;
        const teamNames = ['hero', 'gov', 'villain'];
        
        const enemyTeams = teamNames.filter((_, idx) => idx !== currentTeamTurn);
        
        this.targetSelectionMode = true;
        this.currentAction = 'ultimate';
        
        this.enableTargetSelection(enemyTeams);
    }

    /**
     * 대상 선택 UI 활성화
     */
    enableTargetSelection(enemyTeams) {
        const teamNames = ['hero', 'gov', 'villain'];
        
        // 모든 캐릭터에 클릭 이벤트 추가
        teamNames.forEach((team, idx) => {
            const container = document.getElementById(`team${idx + 1}-characters-combat`);
            if (!container) return;
            
            const characters = container.querySelectorAll('[data-char-id]');
            characters.forEach(char => {
                char.style.cursor = 'pointer';
                char.style.opacity = enemyTeams.includes(team) ? '1' : '0.3';
                char.style.pointerEvents = enemyTeams.includes(team) ? 'auto' : 'none';
                
                const charId = char.dataset.charId;
                
                char.addEventListener('click', () => {
                    this.performAction(team, charId);
                }, { once: true });
            });
        });
        
        // 안내 메시지
        const log = document.getElementById('combat-log');
        if (log) {
            const action = this.currentAction === 'attack' ? '공격' : '궁극기';
            const msg = document.createElement('div');
            msg.className = 'battle-log-entry info';
            msg.textContent = `🎯 ${action}할 대상을 선택하세요.`;
            log.insertBefore(msg, log.firstChild);
        }
    }

    /**
     * 액션 수행
     */
    performAction(targetTeam, targetCharId) {
        this.targetSelectionMode = false;
        const currentTeamTurn = this.app.battleSystem.currentTeamTurn;
        const teamNames = ['hero', 'gov', 'villain'];
        
        // 현재 팀의 캐릭터 중 가장 강한 캐릭터를 공격자로 선택
        const currentTeamName = teamNames[currentTeamTurn];
        const currentTeamChars = this.app.battleSystem.combatCharacters[currentTeamName];
        const attacker = currentTeamChars.find(c => c.hp > 0);
        
        if (!attacker) {
            alert('공격할 수 있는 캐릭터가 없습니다!');
            return;
        }
        
        // 대상 찾기
        const targetChars = this.app.battleSystem.combatCharacters[targetTeam];
        const target = targetChars.find(c => c.id === targetCharId);
        
        if (!target || target.hp <= 0) {
            alert('유효한 대상이 아닙니다!');
            return;
        }
        
        // 액션 실행
        if (this.currentAction === 'attack') {
            this.app.battleSystem.executeAttack(attacker, target, targetTeam);
        } else if (this.currentAction === 'ultimate') {
            this.app.battleSystem.executeUltimate(attacker, target, targetTeam);
        }
        
        // UI 업데이트
        this.app.battleSystem.renderBattle();
        
        // 전투 종료 확인
        if (this.app.battleSystem.checkBattleEnd()) {
            this.endBattle();
        } else {
            // 다음 턴
            this.app.battleSystem.nextTurn();
            this.app.battleSystem.renderBattle();
        }
    }

    /**
     * 방어 액션
     */
    handleDefend() {
        const currentTeamTurn = this.app.battleSystem.currentTeamTurn;
        const teamNames = ['hero', 'gov', 'villain'];
        const currentTeamName = teamNames[currentTeamTurn];
        
        // 현재 팀의 모든 캐릭터 방어 상태 활성화 (이번 턴에만)
        const currentTeamChars = this.app.battleSystem.combatCharacters[currentTeamName];
        currentTeamChars.forEach(char => {
            char.defending = true;
        });
        
        // 로그 추가
        this.app.battleSystem.addLog(`🛡️ ${currentTeamName === 'hero' ? '히어로' : currentTeamName === 'gov' ? '정부' : '빌런'} 팀이 방어 태세를 취했습니다!`);
        
        // UI 업데이트
        this.app.battleSystem.renderBattle();
        
        // 방어 상태 리셋 후 다음 턴
        setTimeout(() => {
            currentTeamChars.forEach(char => {
                char.defending = false;
            });
            this.app.battleSystem.nextTurn();
            this.app.battleSystem.renderBattle();
            
            // 전투 종료 확인
            if (this.app.battleSystem.checkBattleEnd()) {
                this.endBattle();
            }
        }, 1000);
    }

    /**
     * 항복 액션
     */
    handleForfeit() {
        const currentTeamTurn = this.app.battleSystem.currentTeamTurn;
        const teamNames = ['히어로', '정부', '빌런'];
        const forfeittingTeam = teamNames[currentTeamTurn];
        
        // 항복 팀의 모든 캐릭터 HP를 0으로 설정
        const teamNameKeys = ['hero', 'gov', 'villain'];
        this.app.battleSystem.combatCharacters[teamNameKeys[currentTeamTurn]].forEach(char => {
            char.hp = 0;
        });
        
        this.app.battleSystem.addLog(`💀 ${forfeittingTeam} 팀이 항복했습니다!`);
        this.app.battleSystem.renderBattle();
        
        // 전투 종료
        this.endBattle();
    }

    /**
     * 전투 종료
     */
    endBattle() {
        const teamNames = ['hero', 'gov', 'villain'];
        const teamDisplayNames = ['히어로', '정부', '빌런'];
        
        // 승자 팀 결정
        let winnerTeam = null;
        let teamsAlive = 0;
        
        teamNames.forEach((team, idx) => {
            const hasAlive = this.app.battleSystem.combatCharacters[team].some(c => c.hp > 0);
            if (hasAlive) {
                teamsAlive++;
                winnerTeam = idx;
            }
        });
        
        if (teamsAlive === 1) {
            const winner = teamDisplayNames[winnerTeam];
            
            // 전투 기록 업데이트
            const lastRecord = this.app.battleHistory[this.app.battleHistory.length - 1];
            if (lastRecord) {
                lastRecord.winner = winner;
                lastRecord.turnCount = this.app.battleSystem.currentTurn;
            }
            
            this.app.saveToLocalStorage();
            
            // 전투 종료 화면 표시
            this.showBattleEndScreen(winner);
        }
    }

    /**
     * 전투 종료 화면 표시
     */
    showBattleEndScreen(winner) {
        const endScreen = document.getElementById('combat-end');
        if (!endScreen) return;
        
        endScreen.innerHTML = `
            <div style="text-align: center; padding: 32px; color: #fff;">
                <h2 style="font-size: 42px; margin-bottom: 16px;">⚔️ 전투 종료!</h2>
                <p style="font-size: 28px; margin-bottom: 28px; color: #4ade80;">
                    🏆 ${winner} 팀이 승리했습니다!
                </p>
                <p style="font-size: 16px; margin-bottom: 12px; opacity: 0.85;">
                    총 ${this.app.battleSystem.currentTurn} 턴이 소요되었습니다.
                </p>
            </div>
        `;
        
        endScreen.classList.remove('hidden');
        
    }

    /**
     * 전투 리셋
     */
    resetBattle() {
        // 선택 캐릭터 초기화
        this.app.selectedCharacters = {
            hero: [],
            gov: [],
            villain: []
        };
        
        // 전투 시스템 초기화
        this.app.battleSystem.currentTurn = 1;
        this.app.battleSystem.currentTeamTurn = 0;
        this.app.battleSystem.battleLog = [];
        
        // UI 업데이트
        this.app.renderAllTeams();
        this.app.updateSelectedDisplay();
    }
}
