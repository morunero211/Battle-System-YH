/**
 * 캐릭터 관리자 (Character Manager)
 * 캐릭터 렌더링, 검색, 필터링 등 관련 기능
 */

class CharacterManager {
    constructor(app) {
        this.app = app;
    }

    /**
     * 모든 팀 렌더링
     */
    renderAllTeams() {
        this.app.teams.forEach((team, index) => {
            this.renderTeam(index);
        });
        this.app.updateSelectedCharacters();
    }

    /**
     * 특정 팀 렌더링
     */
    renderTeam(teamIndex) {
        const containerId = ['team1-characters', 'team2-characters', 'team3-characters'][teamIndex];
        const container = document.getElementById(containerId);
        if (!container) return;

        const activeScreen = document.querySelector('.screen.screen-active')?.id;
        const isSelectionScreen = activeScreen === 'character-selection';

        container.innerHTML = '';

        const team = this.app.teams[teamIndex];
        team.characters.forEach((char) => {
            const item = document.createElement('div');
            item.className = 'character-item';
            
            if (char.status === 'dead') {
                item.style.opacity = '0.6';
                item.style.background = '#fed7d7';
            } else if (char.status === 'missing') {
                item.style.opacity = '0.7';
                item.style.background = '#feebc8';
            }
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = this.app.isCharacterSelected(teamIndex, char.id);
            checkbox.disabled = char.status !== 'active';
            checkbox.addEventListener('change', (e) => {
                this.app.toggleCharacterSelection(teamIndex, char.id, e.target.checked);
            });

            const info = document.createElement('div');
            info.className = 'character-info';
            info.addEventListener('click', () => {
                // 캐릭터 선택(메인) 화면에서는 수정 금지
                if (!isSelectionScreen && event?.target?.tagName !== 'BUTTON') {
                    this.app.modalManager.openEditCharacterModal(teamIndex, char.id);
                }
            });

            const name = document.createElement('span');
            name.className = 'character-name';
            name.textContent = char.name;
            if (char.status === 'dead') name.textContent += ' 💀';
            if (char.status === 'missing') name.textContent += ' ❓';

            const hp = document.createElement('span');
            hp.className = 'character-hp';
            hp.textContent = `HP: ${char.hp}`;

            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn-remove';
            removeBtn.textContent = '×';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // 캐릭터 선택(메인) 화면에서는 삭제 금지
                if (!isSelectionScreen) {
                    this.app.removeCharacter(teamIndex, char.id);
                }
            });

            info.appendChild(name);
            info.appendChild(hp);

            item.appendChild(checkbox);
            item.appendChild(info);
            if (!isSelectionScreen) {
                item.appendChild(removeBtn);
            }

            if (checkbox.checked) {
                item.classList.add('selected');
            }

            // 블록 전체 클릭하면 체크박스 토글
            item.addEventListener('click', (e) => {
                if (e.target !== removeBtn && e.target.tagName !== 'BUTTON' && char.status === 'active') {
                    checkbox.checked = !checkbox.checked;
                    this.app.toggleCharacterSelection(teamIndex, char.id, checkbox.checked);
                }
            });

            container.appendChild(item);
        });
    }

    /**
     * 팀 검색
     */
    handleSearch(teamIndex, query) {
        const containerId = ['team1-characters', 'team2-characters', 'team3-characters'][teamIndex];
        const container = document.getElementById(containerId);
        if (!container) return;

        const items = container.querySelectorAll('.character-item');
        const lowerQuery = query.toLowerCase();

        items.forEach(item => {
            const nameElement = item.querySelector('.character-name');
            if (nameElement) {
                const charName = nameElement.textContent.toLowerCase();
                item.style.display = charName.includes(lowerQuery) ? 'flex' : 'none';
            }
        });
    }

    /**
     * 캐릭터 추가
     */
    addCharacter(teamIndex, char) {
        this.app.teams[teamIndex].characters.push(char);
        this.app.saveToLocalStorage();
        this.renderTeam(teamIndex);
    }

    /**
     * 캐릭터 제거
     */
    removeCharacter(teamIndex, charId) {
        this.app.teams[teamIndex].characters = this.app.teams[teamIndex].characters.filter(c => c.id !== charId);
        this.app.saveToLocalStorage();
        this.renderTeam(teamIndex);
        this.app.updateSelectedCharacters();
    }

    /**
     * 캐릭터 선택 여부 확인
     */
    isCharacterSelected(teamIndex, charId) {
        const teamNames = ['hero', 'gov', 'villain'];
        return this.app.selectedCharacters[teamNames[teamIndex]]?.includes(charId) || false;
    }

    /**
     * 캐릭터 선택 토글
     */
    toggleCharacterSelection(teamIndex, charId, selected) {
        const teamNames = ['hero', 'gov', 'villain'];
        const teamName = teamNames[teamIndex];

        if (selected) {
            if (!this.app.selectedCharacters[teamName].includes(charId)) {
                this.app.selectedCharacters[teamName].push(charId);
            }
        } else {
            this.app.selectedCharacters[teamName] = this.app.selectedCharacters[teamName].filter(id => id !== charId);
        }

        this.app.updateSelectedCharacters();
        this.renderTeam(teamIndex);
    }
}
