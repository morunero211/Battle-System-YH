/**
 * 데이터 관리자 (Data Manager)
 * 저장/불러오기, JSON 파일 처리
 */

class DataManager {
    constructor(app) {
        this.app = app;
    }

    /**
     * LocalStorage에 저장
     */
    saveToLocalStorage() {
        try {
            const data = {
                teams: this.app.teams,
                selectedCharacters: this.app.selectedCharacters,
                battleHistory: this.app.battleHistory
            };
            localStorage.setItem('battleAppData', JSON.stringify(data));
            console.log('LocalStorage에 저장됨');
        } catch (error) {
            console.error('LocalStorage 저장 실패:', error);
        }
    }

    /**
     * LocalStorage에서 불러오기
     */
    loadFromLocalStorage() {
        try {
            const data = localStorage.getItem('battleAppData');
            if (data) {
                const parsed = JSON.parse(data);
                this.app.teams = parsed.teams || this.app.teams;
                this.app.selectedCharacters = parsed.selectedCharacters || this.app.selectedCharacters;
                this.app.battleHistory = parsed.battleHistory || this.app.battleHistory;
                console.log('LocalStorage에서 로드됨');
            }
        } catch (error) {
            console.error('LocalStorage 로드 실패:', error);
        }
    }

    /**
     * JSON 파일 다운로드
     */
    downloadJSON() {
        const data = {
            teams: this.app.teams,
            selectedCharacters: this.app.selectedCharacters,
            battleHistory: this.app.battleHistory
        };

        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `battle-system-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * JSON 파일 불러오기
     */
    loadJSON(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.teams) {
                    this.app.teams = data.teams;
                }
                if (data.selectedCharacters) {
                    this.app.selectedCharacters = data.selectedCharacters;
                }
                if (data.battleHistory) {
                    this.app.battleHistory = data.battleHistory;
                }
                this.saveToLocalStorage();
                this.app.renderAllTeams();
                alert('캐릭터 데이터가 불러와졌습니다!');
            } catch (error) {
                alert('JSON 파일을 읽는데 실패했습니다.');
                console.error(error);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }
}
