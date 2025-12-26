/**
 * 모달 관리자 (Modal Manager)
 * 캐릭터 생성/수정 모달 관련 모든 기능 처리
 */

class ModalManager {
    constructor(app) {
        this.app = app;
        this.currentEditTeam = null;
        this.currentEditCharId = null;
    }

    /**
     * 캐릭터 추가 모달 열기
     */
    openAddCharacterModal(teamIndex) {
        this.currentEditTeam = teamIndex;
        this.currentEditCharId = null;
        
        if (this.app.elements.modalTitle) {
            this.app.elements.modalTitle.textContent = '캐릭터 생성';
        }
        if (this.app.elements.modalDelete) {
            this.app.elements.modalDelete.classList.add('hidden');
        }
        
        this.clearCustomForm();
        if (this.app.elements.modal) {
            this.app.elements.modal.style.display = 'block';
        }
    }

    /**
     * 캐릭터 수정 모달 열기
     */
    openEditCharacterModal(teamIndex, charId) {
        console.log('openEditCharacterModal 호출됨:', teamIndex, charId);
        this.currentEditTeam = teamIndex;
        this.currentEditCharId = charId;
        
        const char = this.app.teams[teamIndex].characters.find(c => c.id === charId);
        if (!char) {
            console.error('캐릭터를 찾을 수 없음:', teamIndex, charId);
            return;
        }

        // 폼에 데이터 채우기
        if (this.app.elements.charName) this.app.elements.charName.value = char.name;
        if (this.app.elements.charHp) this.app.elements.charHp.value = char.hp;
        if (this.app.elements.skillDescription) this.app.elements.skillDescription.value = char.skillDescription || '';

        // 스탯 설정
        ['attack', 'defense', 'agility', 'skill'].forEach(stat => {
            const radio = document.querySelector(`input[name="${stat}"][value="${char[stat] || 3}"]`);
            if (radio) radio.checked = true;
            const valueSpan = document.getElementById(`${stat}-value`);
            if (valueSpan) valueSpan.textContent = char[stat] || 3;
        });

        // 스킬 타입 설정
        const skillTypeCheckboxes = document.querySelectorAll('input[name="skillType"]');
        skillTypeCheckboxes.forEach(checkbox => {
            checkbox.checked = char.skillTypes && char.skillTypes.includes(checkbox.value);
        });

        // 상태 설정
        const statusRadio = document.querySelector(`input[name="status"][value="${char.status || 'active'}"]`);
        if (statusRadio) statusRadio.checked = true;

        if (this.app.elements.modalTitle) this.app.elements.modalTitle.textContent = '캐릭터 수정';
        if (this.app.elements.modalDelete) this.app.elements.modalDelete.classList.remove('hidden');
        
        console.log('모달 열기 시도, 모달 요소:', this.app.elements.modal);
        if (this.app.elements.modal) {
            this.app.elements.modal.style.display = 'block';
            console.log('모달 display:', this.app.elements.modal.style.display);
        }
    }

    /**
     * 모달 닫기
     */
    closeModal() {
        if (this.app.elements.modal) this.app.elements.modal.style.display = 'none';
        this.currentEditTeam = null;
        this.currentEditCharId = null;
    }

    /**
     * 커스텀 폼 초기화
     */
    clearCustomForm() {
        if (this.app.elements.charName) this.app.elements.charName.value = '';
        if (this.app.elements.charHp) this.app.elements.charHp.value = 100;
        if (this.app.elements.skillDescription) this.app.elements.skillDescription.value = '';
        
        ['attack', 'defense', 'agility', 'skill'].forEach(stat => {
            const radio = document.querySelector(`input[name="${stat}"][value="3"]`);
            if (radio) radio.checked = true;
            const valueSpan = document.getElementById(`${stat}-value`);
            if (valueSpan) valueSpan.textContent = '3';
        });

        document.querySelectorAll('input[name="skillType"]').forEach(cb => cb.checked = false);
        
        const activeRadio = document.querySelector('input[name="status"][value="active"]');
        if (activeRadio) activeRadio.checked = true;
    }

    /**
     * 커스텀 캐릭터 저장
     */
    saveCustomCharacter() {
        const name = this.app.elements.charName?.value.trim();
        if (!name) {
            alert('캐릭터 이름을 입력해주세요!');
            return;
        }

        const hp = parseInt(this.app.elements.charHp?.value || 100);
        if (hp < 10 || hp > 100) {
            alert('HP는 10~100 사이로 입력해주세요!');
            return;
        }

        const attack = parseInt(document.querySelector('input[name="attack"]:checked')?.value || 3);
        const defense = parseInt(document.querySelector('input[name="defense"]:checked')?.value || 3);
        const agility = parseInt(document.querySelector('input[name="agility"]:checked')?.value || 3);
        const skill = parseInt(document.querySelector('input[name="skill"]:checked')?.value || 3);

        const skillTypes = Array.from(document.querySelectorAll('input[name="skillType"]:checked'))
            .map(cb => cb.value);

        const skillDescription = this.app.elements.skillDescription?.value.trim() || '';
        const status = document.querySelector('input[name="status"]:checked')?.value || 'active';

        if (this.currentEditCharId) {
            // 수정
            const char = this.app.teams[this.currentEditTeam].characters.find(c => c.id === this.currentEditCharId);
            if (char) {
                char.name = name;
                char.hp = hp;
                char.attack = attack;
                char.defense = defense;
                char.agility = agility;
                char.skill = skill;
                char.skillTypes = skillTypes;
                char.skillDescription = skillDescription;
                char.status = status;
            }
        } else {
            // 추가
            const newChar = {
                id: Date.now().toString(),
                name,
                hp,
                attack,
                defense,
                agility,
                skill,
                skillTypes,
                skillDescription,
                status
            };
            this.app.teams[this.currentEditTeam].characters.push(newChar);
        }

        this.app.saveToLocalStorage();
        this.app.renderAllTeams();
        this.app.updateCharacterListPage();
        this.closeModal();
    }

    /**
     * 캐릭터 삭제
     */
    deleteCharacter() {
        if (!this.currentEditCharId) return;

        const char = this.app.teams[this.currentEditTeam].characters.find(c => c.id === this.currentEditCharId);
        if (!char) return;

        if (confirm(`'${char.name}'을(를) 정말 삭제하시겠습니까?`)) {
            this.app.teams[this.currentEditTeam].characters = this.app.teams[this.currentEditTeam].characters.filter(c => c.id !== this.currentEditCharId);
            this.app.saveToLocalStorage();
            this.app.renderAllTeams();
            this.app.updateCharacterListPage();
            this.closeModal();
        }
    }
}
