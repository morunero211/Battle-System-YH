/**
 * 페이지 관리자 (Page Manager)
 * 페이지 전환 및 캐릭터 목록 화면 관리
 */

class PageManager {
    constructor(app) {
        this.app = app;
    }

    /**
     * 페이지 표시
     */
    showPage(pageId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('screen-active');
        });
        document.getElementById(pageId)?.classList.add('screen-active');
    }

    /**
     * 캐릭터 목록 페이지 표시
     */
    showCharacterListPage() {
        this.showPage('character-list-screen');
        this.app.renderCharacterList();
    }

    /**
     * 전투 기록 페이지 표시
     */
    showBattleHistoryPage() {
        this.showPage('battle-history-screen');
        this.renderBattleHistory();
    }

    /**
     * 캐릭터 목록 렌더링
     */
    renderCharacterList() {
        console.log('renderCharacterList 호출됨');
        if (!this.app.elements.characterListContent) {
            console.error('characterListContent 요소를 찾을 수 없습니다!');
            return;
        }
        
        this.app.elements.characterListContent.innerHTML = '';

        // 헤더
        const header = document.createElement('div');
        header.className = 'char-table-row header';
        header.innerHTML = `
            <div class="char-table-cell">이름</div>
            <div class="char-table-cell">HP</div>
            <div class="char-table-cell">공격</div>
            <div class="char-table-cell">방어</div>
            <div class="char-table-cell">민첩</div>
            <div class="char-table-cell">스킬</div>
            <div class="char-table-cell">스킬타입</div>
            <div class="char-table-cell">상태</div>
        `;
        this.app.elements.characterListContent.appendChild(header);

        // 모든 캐릭터
        let totalCharacters = 0;
        this.app.teams.forEach((team, teamIndex) => {
            team.characters.forEach(char => {
                totalCharacters++;
                const row = document.createElement('div');
                row.className = 'char-table-row';
                row.dataset.teamIndex = teamIndex;
                row.dataset.charId = char.id;
                row.style.display = 'grid';
                console.log('행 생성:', teamIndex, char.id, char.name);
                
                const skillTags = char.skillTypes ? char.skillTypes.map(type => 
                    `<span class="skill-tag">${type}</span>`
                ).join('') : '';

                const statusClass = char.status || 'active';
                const statusText = {
                    'active': '✅ 활동중',
                    'dead': '💀 사망',
                    'missing': '❓ 실종'
                }[statusClass];

                row.innerHTML = `
                    <div class="char-table-cell">${char.name}</div>
                    <div class="char-table-cell">${char.hp}</div>
                    <div class="char-table-cell">${char.attack || 3}</div>
                    <div class="char-table-cell">${char.defense || 3}</div>
                    <div class="char-table-cell">${char.agility || 3}</div>
                    <div class="char-table-cell">${char.skill || 3}</div>
                    <div class="char-table-cell char-skill-tags">${skillTags || '-'}</div>
                    <div class="char-table-cell"><span class="char-status ${statusClass}">${statusText}</span></div>
                `;
                
                // 클릭 이벤트 바인드
                const clickHandler = () => {
                    console.log('Row clicked! teamIndex:', teamIndex, 'charId:', char.id);
                    this.app.modalManager.openEditCharacterModal(teamIndex, char.id);
                };
                row.addEventListener('click', clickHandler);
                
                this.app.elements.characterListContent.appendChild(row);
            });
        });
        
        console.log('총 캐릭터 수:', totalCharacters);
        this.filterCharacterList();
    }

    /**
     * 캐릭터 목록 필터링
     */
    filterCharacterList() {
        console.log('filterCharacterList 호출됨');
        if (!this.app.elements.characterListContent) return;
        
        const searchQuery = this.app.elements.listSearch?.value.toLowerCase() || '';
        const skillTypeFilter = this.app.elements.skillTypeFilter?.value || '';
        const teamFilter = this.app.elements.teamFilter?.value || '';

        const rows = this.app.elements.characterListContent.querySelectorAll('.char-table-row:not(.header)');
        console.log('필터링할 행의 개수:', rows.length);
        
        rows.forEach(row => {
            const teamIndex = parseInt(row.dataset.teamIndex);
            const charId = row.dataset.charId;
            
            if (isNaN(teamIndex) || !charId) {
                console.log('데이터 부재:', teamIndex, charId);
                return;
            }
            
            const char = this.app.teams[teamIndex].characters.find(c => c.id === charId);
            if (!char) {
                console.log('캐릭터를 찾을 수 없음:', teamIndex, charId);
                return;
            }

            let show = true;

            // 검색어 필터
            if (searchQuery && !char.name.toLowerCase().includes(searchQuery)) {
                show = false;
            }

            // 스킬 타입 필터
            if (skillTypeFilter && (!char.skillTypes || !char.skillTypes.includes(skillTypeFilter))) {
                show = false;
            }

            // 팀 필터
            if (teamFilter && parseInt(teamIndex) !== parseInt(teamFilter)) {
                show = false;
            }

            console.log('행 표시:', char.name, '표시여부:', show);
            row.style.display = show ? 'grid' : 'none';
        });
    }

    /**
     * 전투 기록 렌더링
     */
    renderBattleHistory() {
        const container = this.app.elements.battleHistoryContent;
        if (!container) return;

        container.innerHTML = '';

        if (this.app.battleHistory.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">전투 기록이 없습니다.</p>';
            return;
        }

        this.app.battleHistory.forEach((record, index) => {
            const recordEl = document.createElement('div');
            recordEl.className = 'battle-record';

            const header = document.createElement('div');
            header.className = 'battle-record-header';
            header.innerHTML = `
                <div class="battle-record-title">${record.date} (${record.mode === 'team' ? '팀전' : '개인전'})</div>
                <div class="battle-record-date">승자: ${record.winner}</div>
            `;

            const body = document.createElement('div');
            body.className = 'battle-record-body';

            const teamNames = ['히어로', '정부', '빌런'];
            const teamEmojis = ['🦸', '🏛️', '😈'];
            const teamBorders = ['#90cdf4', '#9ae6b4', '#fbb6ce'];

            // 팀 데이터 배열로 변환
            const teams = [record.teams.hero, record.teams.gov, record.teams.villain];
            
            teams.forEach((team, idx) => {
                const teamSection = document.createElement('div');
                teamSection.className = 'battle-team-section';
                
                // 승자 표시
                if (record.winner === teamNames[idx]) {
                    teamSection.classList.add('battle-winner');
                }
                
                teamSection.style.borderColor = teamBorders[idx];

                // 팀 캐릭터 정보 표시
                let charNames = '캐릭터 없음';
                if (team && team.length > 0) {
                    charNames = team
                        .map(c => `${c.name} (HP: ${c.hp})`)
                        .join('<br>');
                }

                teamSection.innerHTML = `
                    <div class="battle-team-title">${teamEmojis[idx]} ${teamNames[idx]}</div>
                    <div class="battle-team-chars">${charNames}</div>
                `;
                body.appendChild(teamSection);
            });

            recordEl.appendChild(header);
            recordEl.appendChild(body);
            container.appendChild(recordEl);
        });
    }
}
