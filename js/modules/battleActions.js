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

        // 스킬(궁극기) 버튼
        document.getElementById('action-ultimate')?.addEventListener('click', () => {
            this.selectTargetForUltimate();
        });

        // 시간 종료 버튼(타임아웃 판정)
        document.getElementById('forfeit-button')?.addEventListener('click', () => {
            if (this.app?.battleSystem?.pendingDefenseResponse) {
                alert('방어자 응답 선택 중에는 시간 종료할 수 없습니다.');
                return;
            }
            if (confirm('시간 종료하시겠습니까? (현재 HP 상태로 승패를 판정합니다)')) {
                this.handleTimeoutEnd();
            }
        });

        // 전투 결과 모달 닫기
        document.getElementById('battle-result-close')?.addEventListener('click', () => this.hideBattleResultModal());
        document.getElementById('battle-result-ok')?.addEventListener('click', () => this.hideBattleResultModal());

    }

    computeAverageHp(teamKeys) {
        const chars = teamKeys.flatMap((k) => this.app.battleSystem.combatCharacters[k] || []);
        const count = chars.length;
        const sumHp = chars.reduce((acc, c) => acc + Math.max(0, Math.round(Number(c.hp) || 0)), 0);
        const avgHp = count > 0 ? (sumHp / count) : 0;
        return { avgHp, sumHp, count };
    }

    computeTimeoutOutcome() {
        // 팀 규칙: 히어로+정부 = 같은 팀, 빌런 = 상대 팀
        const ally = this.computeAverageHp(['hero', 'gov']);
        const villain = this.computeAverageHp(['villain']);

        let winner = '무승부';
        if (ally.avgHp > villain.avgHp) winner = '히어로/정부 연합';
        else if (ally.avgHp < villain.avgHp) winner = '빌런';

        return {
            winner,
            ally,
            villain
        };
    }

    handleTimeoutEnd() {
        const outcome = this.computeTimeoutOutcome();

        this.app.battleSystem.addLog('⏱️ 시간 종료! 현재 HP 상태로 승패를 판정합니다.');
        this.app.battleSystem.renderBattle();

        // 전투 기록 업데이트(현재 HP 상태 그대로 저장)
        const lastRecord = this.app.battleHistory?.[this.app.battleHistory.length - 1];
        if (lastRecord) {
            lastRecord.winner = outcome.winner;
            lastRecord.turnCount = this.app.battleSystem.currentTurn;
            lastRecord.endReason = 'TIMEOUT';
            lastRecord.scores = {
                allyAvgHp: outcome.ally.avgHp,
                allySumHp: outcome.ally.sumHp,
                allyCount: outcome.ally.count,
                villainAvgHp: outcome.villain.avgHp,
                villainSumHp: outcome.villain.sumHp,
                villainCount: outcome.villain.count
            };
        }

        this.app.saveToLocalStorage();

        // 전투는 종료 처리(추가 액션 방지)
        this.app.battleSystem.setActionButtonsEnabled(false);
        this.showBattleResultModal(outcome);
    }

    showBattleResultModal(outcome) {
        const modal = document.getElementById('battle-result-modal');
        const winnerEl = document.getElementById('battle-result-winner');
        const scoresEl = document.getElementById('battle-result-scores');

        if (winnerEl) {
            winnerEl.textContent = `🏆 승리: ${outcome.winner}`;
        }

        if (scoresEl) {
            const allyAvg = Math.round(outcome.ally.avgHp * 10) / 10;
            const villainAvg = Math.round(outcome.villain.avgHp * 10) / 10;

            scoresEl.innerHTML = `
                <div style="font-weight:800; margin-bottom:8px;">판정 기준</div>
                <div>히어로/정부 팀 평균 HP vs 빌런 팀 평균 HP</div>
                <div style="height:10px;"></div>
                <div style="font-weight:800; margin-bottom:6px;">점수</div>
                <div>히어로/정부: 평균 ${allyAvg} (총합 ${outcome.ally.sumHp} / ${outcome.ally.count}명)</div>
                <div>빌런: 평균 ${villainAvg} (총합 ${outcome.villain.sumHp} / ${outcome.villain.count}명)</div>
            `;
        }

        if (modal) modal.style.display = 'flex';
    }

    hideBattleResultModal() {
        const modal = document.getElementById('battle-result-modal');
        if (modal) modal.style.display = 'none';
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
            const msg = document.createElement('div');
            msg.className = 'battle-log-entry info';
            const action = this.currentAction === 'ultimate' ? '스킬' : '공격';
            msg.textContent = `🎯 ${action}할 대상을 선택하세요.`;
            log.insertBefore(msg, log.firstChild);
        }
    }

    /**
     * 액션 수행
     */
    async performAction(targetTeam, targetCharId) {
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
        if (this.currentAction === 'ultimate') {
            this.app.battleSystem.executeUltimate(attacker, target, targetTeam);
        } else {
            const result = await this.app.battleSystem.executeAttack(attacker, target, targetTeam, currentTeamName);

            // 2-step 방어자 응답 대기 중이면 같은 턴 안에서 일시정지
            if (result && result.awaitingResponse) {
                this.app.battleSystem.renderBattle();
                return;
            }
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
