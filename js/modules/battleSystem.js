/**
 * 전투 시스템 (Battle System)
 * 턴제 전투 로직 관리
 */

class BattleSystem {
    constructor(app) {
        this.app = app;
        this.currentBattle = null;
        this.currentTurn = 0;
        this.currentTeamTurn = 0; // 0: 히어로, 1: 정부, 2: 빌런
        this.battleLog = [];
        this.combatCharacters = {
            hero: [],
            gov: [],
            villain: []
        };
        this.usedUltimate = {}; // 전투 내 궁극기 사용 기록 (charId => true)
    }

    /**
     * 전투 초기화
     */
    initializeBattle() {
        this.currentTurn = 1;
        this.currentTeamTurn = 0;
        this.battleLog = [];
        this.usedUltimate = {};
        
        // 선택된 캐릭터들로 전투 캐릭터 설정
        this.combatCharacters = {
            hero: this.app.teams[0].characters.filter(c => 
                this.app.selectedCharacters.hero.includes(c.id)
            ),
            gov: this.app.teams[1].characters.filter(c => 
                this.app.selectedCharacters.gov.includes(c.id)
            ),
            villain: this.app.teams[2].characters.filter(c => 
                this.app.selectedCharacters.villain.includes(c.id)
            )
        };

        this.addLog(`⚔️ 전투 시작! (${this.app.battleMode === 'team' ? '팀전' : '개인전'} 모드)`);
        this.addLog(`히어로: ${this.combatCharacters.hero.length}명 | 정부: ${this.combatCharacters.gov.length}명 | 빌런: ${this.combatCharacters.villain.length}명`);
        this.addLog('---');
    }

    /**
     * 전투 렌더링
     */
    renderBattle() {
        // 히어로 팀
        const heroContainer = document.getElementById('team1-characters-combat');
        if (heroContainer) {
            heroContainer.innerHTML = this.combatCharacters.hero
                .map(char => this.createCharacterDisplay(char, 'hero'))
                .join('');
        }

        // 정부 팀
        const govContainer = document.getElementById('team2-characters-combat');
        if (govContainer) {
            govContainer.innerHTML = this.combatCharacters.gov
                .map(char => this.createCharacterDisplay(char, 'gov'))
                .join('');
        }

        // 빌런 팀
        const villainContainer = document.getElementById('team3-characters-combat');
        if (villainContainer) {
            villainContainer.innerHTML = this.combatCharacters.villain
                .map(char => this.createCharacterDisplay(char, 'villain'))
                .join('');
        }

        this.renderLog();
        this.updateTurnInfo();
        this.updateSkillSlots();
    }

    /**
     * 캐릭터 표시 생성
     */
    createCharacterDisplay(char, team) {
        const maxHp = char.maxHp || 100;
        const hpPercent = Math.max(0, Math.min(100, Math.round((char.hp / maxHp) * 100)));
        const tags = (char.skillTypes || []).map(type => {
            if (type === '공격형') return '<span class="tag tag-attack">공격형</span>';
            if (type === '방어형') return '<span class="tag tag-defense">방어형</span>';
            if (type === '지원형') return '<span class="tag tag-support">지원형</span>';
            if (type === '치료형') return '<span class="tag tag-heal">치료형</span>';
            return `<span class="tag">${type}</span>`;
        }).join('');

        return `
            <div class="combat-char-card" data-char-id="${char.id}" data-team="${team}">
                <div class="char-top">
                    <div class="char-name">${char.name}</div>
                    <div class="char-tags">${tags || '<span class="tag tag-empty">-</span>'}</div>
                </div>
                <div class="hp-row">
                    <div class="hp-label">HP ${char.hp}/${maxHp}</div>
                    <div class="hp-bar"><span style="width: ${hpPercent}%;"></span></div>
                </div>
                <div class="stat-row">
                    <span>⚔️ ${char.attack}</span>
                    <span>🛡️ ${char.defense}</span>
                    <span>💨 ${char.agility}</span>
                    <span>⭐ ${char.skill}</span>
                </div>
            </div>
        `;
    }

    /**
     * 턴 정보 업데이트
     */
    updateTurnInfo() {
        const turnCountEl = document.getElementById('turn-count');
        const turnTextEl = document.getElementById('current-turn-text');
        
        if (turnCountEl) turnCountEl.textContent = this.currentTurn;
        
        const teamNames = ['🦸 히어로', '🏛️ 정부', '😈 빌런'];
        if (turnTextEl) {
            turnTextEl.textContent = `현재 차례: ${teamNames[this.currentTeamTurn]}`;
        }
    }

    /**
     * 우측 패널 슬롯 자동 채움
     * 현재 차례 팀의 상위 3명 기준으로 표시
     */
    updateSkillSlots() {
        const panel = document.getElementById('skill-status');
        if (!panel) return;
        const bodies = panel.querySelectorAll('.skill-block .skill-block-body');
        const teamKeys = ['hero', 'gov', 'villain'];
        const key = teamKeys[this.currentTeamTurn] || 'hero';
        const chars = this.combatCharacters[key] || [];

        for (let i = 0; i < bodies.length; i++) {
            const bodyEl = bodies[i];
            const char = chars[i];
            if (!bodyEl) continue;
            if (char) {
                bodyEl.classList.remove('placeholder');
                const type = (char.skillTypes && char.skillTypes.length > 0) ? char.skillTypes[0] : '(비어있음)';
                const name = char.name || '(비어있음)';
                const desc = char.skillDescription || '(비어있음)';
                bodyEl.textContent = `${type} · ${name} — ${desc}`;
            } else {
                bodyEl.classList.add('placeholder');
                bodyEl.textContent = '(비어있음)';
            }
        }
    }

    /**
     * 로그 추가
     */
    addLog(message) {
        const timestamp = new Date().toLocaleTimeString('ko-KR');
        this.battleLog.push(`[${timestamp}] ${message}`);
    }

    /**
     * 로그 렌더링
     */
    renderLog() {
        const logEl = document.getElementById('combat-log');
        if (logEl) {
            logEl.innerHTML = this.battleLog
                .slice(-20) // 최근 20개만 표시
                .map(log => `<div style="padding: 6px 0; border-bottom: 1px solid #eee;">${log}</div>`)
                .join('');
            logEl.scrollTop = logEl.scrollHeight; // 자동 스크롤
        }
    }

    /**
     * 공격 실행 (클라이언트 사이드 계산)
     */
    async executeAttack(attacker, defender, targetTeam) {
        try {
            // 클라이언트에서 직접 계산 (API 없음)
            this.addLog(`\n⚔️ ${attacker.name} → ${defender.name} 공격!`);
            
            // 주사위 100 굴림
            const attackRoll = Math.floor(Math.random() * 100) + 1;
            const defendRoll = Math.floor(Math.random() * 100) + 1;
            
            // 공격 판정
            const attackPower = attacker.attack * 10 + attacker.skill * 5;
            const defensePower = defender.defense * 10 + defender.agility * 5;
            
            this.addLog(`  🎲 공격 주사위: ${attackRoll} (필요: ${attackPower})`);
            this.addLog(`  🛡️ 방어 주사위: ${defendRoll} (능력: ${defensePower})`);
            
            if (attackRoll <= 30) {
                // 30% 치명타
                const criticalDamage = Math.floor((attacker.attack * 3 + attacker.skill) * 1.5);
                defender.hp = Math.max(0, defender.hp - criticalDamage);
                this.addLog(`  💥 치명타! ${criticalDamage} 데미지!`);
            } else if (attackRoll > 50) {
                // 50% 이상 미스
                this.addLog(`  ❌ 공격 미스!`);
            } else {
                // 일반 공격
                const damage = Math.floor(attacker.attack * 2 + attacker.skill - (defender.defense * 0.5));
                defender.hp = Math.max(0, defender.hp - damage);
                this.addLog(`  ✅ 명중! ${damage} 데미지!`);
            }
            
            this.addLog(`  💚 ${defender.name} HP: ${defender.hp}`);

        } catch (error) {
            console.error('전투 계산 에러:', error);
            this.addLog(`❌ 전투 계산 중 오류: ${error.message}`);
        }
    }

    /**
     * 방어 실행
     */
    executeDefend(defender) {
        this.addLog(`🛡️ ${defender.name}이(가) 방어 태세를 취했습니다!`);
    }

    /**
     * 궁극기 실행
     */
    executeUltimate(attacker, defender, targetTeam) {
        this.addLog(`\n⭐ ${attacker.name} → ${defender.name} 궁극기 시전!`);
        this.addLog(`  💫 궁극기는 100% 명중합니다!`);
        
        // 1. 크리티컬 판정 (궁극기도 크리티컬 가능)
        const critRoll = Math.floor(Math.random() * 100) + 1;
        const critRate = Math.min(attacker.skill * 5, 50);
        const isCritical = critRoll <= critRate;
        this.addLog(`  🎲 크리티컬 판정: ${critRoll} / ${critRate}`);
        
        // 2. 데미지 계산 (기본 2배 데미지)
        const baseDamage = (attacker.skill + attacker.attack) * 15;
        const defense = defender.defense * 3;
        let damage = Math.max(Math.floor(baseDamage - defense), 1);
        
        if (isCritical) {
            damage = Math.floor(damage * 1.5);
            this.addLog(`  💥 크리티컬 히트! 추가 1.5배 데미지!`);
        }
        
        this.addLog(`  📊 데미지 계산: (스킬 ${attacker.skill} + 공격 ${attacker.attack}) × 15 - 방어력 ${defense} ${isCritical ? '× 1.5' : ''} = ${damage}`);
        
        // 3. 데미지 적용
        defender.hp = Math.max(defender.hp - damage, 0);
        this.addLog(`  💔 ${defender.name} HP: ${defender.hp + damage} → ${defender.hp}`);
        
        if (attacker && attacker.id) {
            this.usedUltimate[attacker.id] = true;
        }
        
        if (defender.hp <= 0) {
            this.addLog(`  💀 ${defender.name}이(가) 쓰러졌습니다!`);
        }
    }

    /**
     * 턴 진행
     */
    nextTurn() {
        this.currentTeamTurn = (this.currentTeamTurn + 1) % 3;
        
        if (this.currentTeamTurn === 0) {
            this.currentTurn++;
            this.addLog(`\n========== 턴 ${this.currentTurn} ==========`);
        }

        this.checkBattleEnd();
        this.renderBattle();
        this.updateSkillSlots();
    }

    /**
     * 전투 종료 확인
     */
    checkBattleEnd() {
        const heroAlive = this.combatCharacters.hero.some(c => c.hp > 0);
        const govAlive = this.combatCharacters.gov.some(c => c.hp > 0);
        const villainAlive = this.combatCharacters.villain.some(c => c.hp > 0);

        const aliveTeams = [heroAlive, govAlive, villainAlive].filter(v => v).length;

        if (aliveTeams === 1) {
            this.endBattle();
        }
    }

    /**
     * 전투 종료
     */
    endBattle() {
        const heroAlive = this.combatCharacters.hero.some(c => c.hp > 0);
        const govAlive = this.combatCharacters.gov.some(c => c.hp > 0);
        const villainAlive = this.combatCharacters.villain.some(c => c.hp > 0);

        let winner = '미정';
        if (heroAlive) winner = '히어로';
        else if (govAlive) winner = '정부';
        else if (villainAlive) winner = '빌런';

        this.addLog(`\n🏆 전투 종료! 승자: ${winner}`);

        // 마지막 전투 기록 업데이트 + 최종 HP/스킬 사용 기록 + 스탯 변화 저장
        if (this.app.battleHistory.length > 0) {
            const rec = this.app.battleHistory[this.app.battleHistory.length - 1];
            rec.winner = winner;

            // 최종 HP 맵(id -> hp)
            const finalHp = {};
            const finalStats = {};
            ['hero','gov','villain'].forEach(teamKey => {
                (this.combatCharacters[teamKey] || []).forEach(c => {
                    if (c && c.id) {
                        finalHp[c.id] = c.hp;
                        finalStats[c.id] = {
                            attack: c.attack,
                            defense: c.defense,
                            agility: c.agility,
                            skill: c.skill,
                            status: c.status
                        };
                    }
                });
            });
            rec.finalHp = finalHp;
            rec.finalStats = finalStats;
            rec.usedUltimate = { ...this.usedUltimate };
            this.app.saveToLocalStorage();
        }

        this.showBattleEnd(winner);
    }

    /**
     * 전투 종료 화면 표시
     */
    showBattleEnd(winner) {
        const endScreen = document.getElementById('combat-end');
        if (endScreen) {
            document.getElementById('end-title').textContent = `🏆 ${winner} 팀 승리!`;
            document.getElementById('end-message').textContent = `${this.currentTurn}턴 만에 전투가 종료되었습니다.`;
            endScreen.classList.remove('hidden');
        }
    }

}
