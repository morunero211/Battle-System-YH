/**
 * Combat.js - 전투 시스템 클래스
 * COC(Chance of Success) 방식의 d100 판정을 사용한 전투 로직
 */

class Combat {
    /**
     * 전투 시스템 초기화
     * @param {array} teamsArray - 팀 배열 (각 팀은 캐릭터 배열)
     */
    constructor(teamsArray, is1v1 = false) {
        this.teams = teamsArray;              // 모든 팀 배열
        this.numTeams = teamsArray.length;    // 팀 수
        this.is1v1 = is1v1;                   // 1:1 전투 모드 여부
        this.currentTurn = 1;                 // 현재 턴 (1부터 시작)
        this.currentTeam = 0;                 // 현재 차례인 팀 (0부터 시작)
        this.currentCharIndex = 0;            // 현재 캐릭터 인덱스
        this.turnOrder = [];                  // 민첩 기반 턴 순서
        this.turnPosition = 0;                // 턴 순서 포인터
        this.battleLog = [];                  // 전투 로그
        this.isOver = false;                  // 전투 종료 여부
        this.winner = null;                   // 승자 (0, 1, 2 등, null이면 진행 중)
        
        // 모든 캐릭터 HP를 100으로 설정
        this.teams.forEach(team => {
            team.forEach(char => {
                char.maxHp = 100;
                char.currentHp = 100;
            });
        });
        
        this.initializeBattle();
    }

    /**
     * 전투 초기화
     */
    initializeBattle() {
        this.addLog('⚔️ 전투가 시작되었습니다!');
        const teamInfo = this.teams.map((team, idx) => `팀${idx + 1}: ${team.length}명`).join(' vs ');
        this.addLog(teamInfo);
        this.addLog('─'.repeat(50));
        this.addLog(`[ 턴 ${this.currentTurn} ]`);

        this.buildTurnOrder();
    }

    /**
     * 민첩(기존 회피) 값을 d100 목표치로 변환 (1→30, 5→80 선형 보간)
     * @param {number} statLevel - 1~5 스탯
     * @returns {number} 30~80 목표치
     */
    getStatThreshold(statLevel) {
        const clamped = Math.max(1, Math.min(5, statLevel || 1));
        const min = 30;
        const max = 80;
        return Math.round(min + ((clamped - 1) * (max - min) / 4));
    }

    /**
     * 성공 단계 평가
     * @param {number} statLevel - 1~5 스탯
     * @returns {{roll:number,target:number,grade:string,success:boolean}}
     */
    rollForStat(statLevel) {
        const roll = this.rollD100();
        const target = this.getStatThreshold(statLevel);
        const success = roll <= target;

        let grade = 'fail';
        if (success) {
            if (roll === 1) {
                grade = 'criticalSuccess';
            } else if (roll <= target / 5) {
                grade = 'extremeSuccess';
            } else if (roll <= target / 2) {
                grade = 'hardSuccess';
            } else {
                grade = 'success';
            }
        } else {
            if ((statLevel <= 2 && roll >= 95) || (statLevel >= 3 && roll === 100)) {
                grade = 'fumble';
            }
        }

        return { roll, target, grade, success };
    }

    /**
     * 성공 등급 비교용 숫자 반환
     */
    getGradeRank(grade) {
        const ranks = {
            fail: 0,
            success: 1,
            hardSuccess: 2,
            extremeSuccess: 3,
            criticalSuccess: 4,
            fumble: -1
        };
        return ranks[grade] ?? 0;
    }

    /**
     * 한국어 등급 라벨
     */
    getGradeLabel(grade) {
        switch (grade) {
            case 'criticalSuccess':
                return '대성공';
            case 'extremeSuccess':
                return '극단적 성공';
            case 'hardSuccess':
                return '어려운 성공';
            case 'success':
                return '일반 성공';
            case 'fumble':
                return '대실패';
            default:
                return '실패';
        }
    }

    /**
     * 턴 순서 생성 (민첩 내림차순, 동률 시 주사위 높을수록 선행)
     */
    buildTurnOrder() {
        this.turnOrder = [];
        this.teams.forEach((team, teamIdx) => {
            team.forEach((char, charIdx) => {
                if (char.isAliveCheck()) {
                    const agilityScore = this.getStatThreshold(char.agility);
                    const tieBreaker = this.rollD100();
                    this.turnOrder.push({
                        team: teamIdx,
                        index: charIdx,
                        agilityScore,
                        tieBreaker
                    });
                }
            });
        });

        this.turnOrder.sort((a, b) => {
            if (b.agilityScore !== a.agilityScore) return b.agilityScore - a.agilityScore;
            return b.tieBreaker - a.tieBreaker;
        });

        this.turnPosition = 0;
        this.syncCurrentActor();
    }

    /**
     * 현재 차례 포인터에 맞춰 배우 정보 동기화
     */
    syncCurrentActor() {
        if (this.turnOrder.length === 0) {
            this.checkBattleEnd();
            return;
        }

        while (this.turnPosition < this.turnOrder.length) {
            const entry = this.turnOrder[this.turnPosition];
            const char = this.teams[entry.team]?.[entry.index];
            if (char && char.isAliveCheck()) {
                this.currentTeam = entry.team;
                this.currentCharIndex = entry.index;
                return;
            }
            this.turnPosition++;
        }

        // 턴 배열을 소진했으면 새 라운드 시작
        if (!this.isOver) {
            this.startNewRound();
        }
    }

    /**
     * 라운드 종료 후 새 라운드 시작
     */
    startNewRound() {
        if (this.isOver) return;
        this.currentTurn++;
        this.addLog(`\n[ 턴 ${this.currentTurn} ]`);
        this.buildTurnOrder();
    }

    /**
     * 현재 팀 반환
     * @returns {array} 현재 팀의 캐릭터 배열
     */
    getCurrentTeam() {
        return this.teams[this.currentTeam] || [];
    }

    /**
     * 특정 팀 반환
     * @param {number} teamIndex - 팀 인덱스
     * @returns {array} 해당 팀의 캐릭터 배열
     */
    getTeam(teamIndex) {
        return this.teams[teamIndex] || [];
    }

    /**
     * 현재 캐릭터 반환
     * @returns {Character} 현재 차례의 캐릭터
     */
    getCurrentCharacter() {
        return this.getCurrentTeam()[this.currentCharIndex];
    }

    /**
     * 공격 실행 (회피/반격 대응 포함)
     * @param {number} targetTeamIndex - 공격 대상 팀 인덱스
     * @param {number} targetIndex - 공격 대상의 인덱스
     * @param {'evade'|'counter'} reaction - 방어 행동
     * @returns {object} 공격 결과
     */
    performAttack(targetTeamIndex, targetIndex, reaction = 'evade') {
        const attacker = this.getCurrentCharacter();
        const defender = this.getTeam(targetTeamIndex)[targetIndex];

        if (!attacker || !defender) {
            return { success: false, message: '잘못된 대상입니다.' };
        }

        const attackRoll = this.rollForStat(attacker.attack);

        // 공격 실패 or 대실패 처리
        if (!attackRoll.success) {
            const label = this.getGradeLabel(attackRoll.grade);
            this.addLog(`${attacker.name}의 공격이 ${label}으로 실패했습니다. (주사위 ${attackRoll.roll}/${attackRoll.target})`);
            this.endCharacterTurn();
            return { success: false, attackRoll, reaction }; // 실패 결과
        }

        const reactionType = reaction === 'counter' ? 'counter' : 'evade';
        let defenderRoll = null;

        // 회피: 성공 등급이 공격과 동률 이상이면 회피 성공
        if (reactionType === 'evade') {
            defenderRoll = this.rollForStat(defender.agility);
            if (defenderRoll.success) {
                const attackRank = this.getGradeRank(attackRoll.grade);
                const defendRank = this.getGradeRank(defenderRoll.grade);
                if (defendRank >= attackRank) {
                    this.addLog(`${defender.name}이(가) 회피에 성공했습니다! (${this.getGradeLabel(defenderRoll.grade)} | 주사위 ${defenderRoll.roll}/${defenderRoll.target})`);
                    this.endCharacterTurn();
                    return { success: false, attackRoll, defenderRoll, reaction: reactionType, evaded: true };
                }
            }
        }

        // 반격: 방어자가 성공하면 반격이 우선 적용
        if (reactionType === 'counter') {
            defenderRoll = this.rollForStat(defender.attack);
            if (defenderRoll.success) {
                const counterDamage = this.applyDamage(defender, attacker, defenderRoll.grade === 'criticalSuccess');
                const gradeLabel = this.getGradeLabel(defenderRoll.grade);
                this.addLog(`⚡ ${defender.name}의 반격 ${gradeLabel}! ${attacker.name}에게 ${counterDamage} 피해.`);

                if (!attacker.isAliveCheck()) {
                    this.addLog(`💀 ${attacker.name}이(가) 반격에 쓰러졌습니다!`);
                }

                this.endCharacterTurn();
                return {
                    success: true,
                    attackRoll,
                    defenderRoll,
                    reaction: reactionType,
                    counterDamage
                };
            }
        }

        // 공격 피해 적용 (회피 실패 or 반격 실패)
        const isCritical = attackRoll.grade === 'criticalSuccess';
        const dealtDamage = this.applyDamage(attacker, defender, isCritical);
        const gradeLabel = this.getGradeLabel(attackRoll.grade);
        this.addLog(`${attacker.name}의 공격 ${gradeLabel}! ${defender.name}에게 ${dealtDamage} 피해.`);

        if (!defender.isAliveCheck()) {
            this.addLog(`💀 ${defender.name}이(가) 쓰러졌습니다!`);
        }

        this.endCharacterTurn();
        return {
            success: true,
            attackRoll,
            defenderRoll,
            reaction: reactionType,
            damage: dealtDamage
        };
    }

    /**
     * 피해 계산 및 적용
     */
    applyDamage(attacker, defender, isCritical = false) {
        const baseDamage = Math.max(
            5,
            (attacker.attack - defender.defense) + Math.floor(Math.random() * 20)
        );

        const finalDamage = Math.floor(isCritical ? baseDamage * 1.5 : baseDamage);
        return defender.takeDamage(finalDamage);
    }

    /**
     * 방어 실행
     * @returns {object} 방어 결과
     */
    performDefend() {
        const defender = this.getCurrentCharacter();
        
        defender.setDefending();
        this.addLog(`${defender.name}이(가) 방어 자세를 취했습니다! (🛡️ 이번 턴 피해 50% 감소)`);
        
        this.endCharacterTurn();
        
        return {
            character: defender.name,
            action: 'defend',
            success: true
        };
    }

    /**
     * 궁극기 실행 (선택적)
     * @param {number} targetTeamIndex - 공격 대상 팀 인덱스
     * @param {number} targetIndex - 대상 인덱스
     * @returns {object} 궁극기 결과
     */
    performUltimate(targetTeamIndex, targetIndex) {
        const attacker = this.getCurrentCharacter();
        const defender = this.getTeam(targetTeamIndex)[targetIndex];

        if (!attacker || !defender) {
            return { success: false, message: '잘못된 대상입니다.' };
        }

        // 궁극기는 무조건 성공하고, 크리티컬 + 2배 피해
        const baseDamage = Math.max(
            10,
            (attacker.attack * 1.5 - defender.defense) + Math.floor(Math.random() * 30)
        );
        
        const ultimateDamage = Math.floor(baseDamage * 2);
        
        const realDamage = defender.takeDamage(ultimateDamage);
        
        this.addLog(`⭐ ${attacker.name}이(가) 궁극기를 사용했습니다! ⭐`);
        this.addLog(`💥 엄청난 공격! ${defender.name}에게 ${Math.floor(realDamage)} 피해!`);

        if (!defender.isAliveCheck()) {
            this.addLog(`💀 ${defender.name}이(가) 쓰러졌습니다!`);
        }

        this.endCharacterTurn();
        
        return {
            attacker: attacker.name,
            defender: defender.name,
            damage: ultimateDamage,
            success: true
        };
    }

    /**
     * 현재 캐릭터의 턴 종료
     */
    endCharacterTurn() {
        const character = this.getCurrentCharacter();
        if (character) {
            character.endTurn();
        }
        this.advanceTurn();
    }

    /**
     * 턴 포인터를 다음으로 이동
     */
    advanceTurn() {
        this.turnPosition++;
        if (this.turnPosition >= this.turnOrder.length) {
            this.startNewRound();
        }
        this.syncCurrentActor();
        this.checkBattleEnd();
    }

    /**
     * d100 주사위 굴리기 (1~100)
     * @returns {number} 1~100 사이의 랜덤 숫자
     */
    rollD100() {
        return Math.floor(Math.random() * 100) + 1;
    }

    /**
     * 전투 종료 확인
     */
    checkBattleEnd() {
        const aliveTeams = this.teams.map((team, idx) => ({
            teamIndex: idx,
            aliveCount: team.filter(char => char.isAliveCheck()).length
        })).filter(t => t.aliveCount > 0);

        if (aliveTeams.length === 0) {
            this.isOver = true;
            this.winner = 'draw';
            this.addLog('\n🤝 무승부! 모두 쓰러졌습니다!');
        } else if (aliveTeams.length === 1) {
            this.isOver = true;
            this.winner = aliveTeams[0].teamIndex + 1;
            this.addLog(`\n🎉 팀${this.winner} 승리! 다른 모든 팀이 쓰러졌습니다!`);
        }
    }

    /**
     * 생존한 적 캐릭터 배열 반환
     * 팀전: 히어로(0)와 정부(1)는 서로 공격 불가, 빌런(2)과는 공격 가능
     * 개인전: 현재 팀 제외 모두
     * @returns {array} {team, index, character} 형태의 배열
     */
    getAliveEnemies() {
        const aliveEnemies = [];
        this.teams.forEach((team, teamIdx) => {
            team.forEach((char, charIdx) => {
                if (char.isAliveCheck()) {
                    // 팀전: 같은 팀은 제외
                    if (!this.is1v1 && teamIdx === this.currentTeam) {
                        return;
                    }
                    
                    // 팀전: 히어로(0)와 정부(1)는 서로 공격 불가
                    if (!this.is1v1) {
                        const canAttack = !(
                            (this.currentTeam === 0 && teamIdx === 1) || // 히어로는 정부 공격 불가
                            (this.currentTeam === 1 && teamIdx === 0)    // 정부는 히어로 공격 불가
                        );
                        if (!canAttack) {
                            return;
                        }
                    }
                    
                    // 개인전: 현재 팀의 현재 캐릭터는 제외
                    if (this.is1v1 && teamIdx === this.currentTeam && charIdx === this.currentCharIndex) {
                        return;
                    }
                    aliveEnemies.push({
                        team: teamIdx,
                        index: charIdx,
                        character: char
                    });
                }
            });
        });
        return aliveEnemies;
    }

    /**
     * 전투 도중 종료 (체력이 가장 많이 남은 쪽 승리)
     */
    forfeitBattle() {
        if (this.isOver) return;
        
        this.addLog('\n⏱️ 시간 종료! 체력이 가장 많이 남은 측이 승리합니다.');
        
        // 각 팀별 최대 체력 계산
        const teamHPs = this.teams.map((team, idx) => {
            const totalHp = team.reduce((sum, char) => sum + (char.currentHp || 0), 0);
            return { team: idx, hp: totalHp };
        });
        
        // 체력이 가장 많은 팀 찾기
        const winner = teamHPs.reduce((max, current) => 
            current.hp > max.hp ? current : max
        );
        
        this.isOver = true;
        this.winner = winner.team + 1;
        this.addLog(`💪 팀${this.winner}의 최대 체력: ${winner.hp}`);
    }

    /**
     * 전투 로그에 메시지 추가
     * @param {string} message - 추가할 메시지
     */
    addLog(message) {
        this.battleLog.push(message);
    }

    /**
     * 전체 전투 로그 반환
     * @returns {string} 전체 로그를 한 문자열로 반환
     */
    getFullLog() {
        return this.battleLog.join('\n');
    }

    /**
     * 전투 상태 요약
     * @returns {object} 현재 전투 상태
     */
    getStatus() {
        const currentChar = this.getCurrentCharacter();
        return {
            turn: this.currentTurn,
            currentTeam: this.isOver ? null : this.currentTeam + 1,
            currentCharacter: currentChar ? currentChar.getShortInfo() : null,
            teamsStatus: this.teams.map(team => team.map(char => ({
                name: char.name,
                hp: char.currentHp,
                maxHp: char.maxHp,
                alive: char.isAliveCheck()
            })) ),
            isOver: this.isOver,
            winner: this.winner
        };
    }
}
