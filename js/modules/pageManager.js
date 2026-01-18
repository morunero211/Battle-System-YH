/**
 * 페이지 관리자 (Page Manager)
 * 페이지 전환 및 목록/기록 화면 진입점을 제공합니다.
 *
 * NOTE: 현재 UI의 실제 렌더/동작은 `BattleApp`에 구현되어 있으며,
 * 이 클래스는 레거시 호출부/모듈 간 의존을 위해 얇은 래퍼로 유지합니다.
 */

class PageManager {
    constructor(app) {
        this.app = app;
    }

    showPage(pageId) {
        return this.app.showPage(pageId);
    }

    showCharacterListPage() {
        if (typeof this.app.showCharacterListPage === 'function') {
            return this.app.showCharacterListPage();
        }
        this.showPage('character-list-screen');
        return this.renderCharacterList();
    }

    showBattleHistoryPage() {
        if (typeof this.app.showBattleHistoryPage === 'function') {
            return this.app.showBattleHistoryPage();
        }
        this.showPage('battle-history-screen');
        return this.renderBattleHistory();
    }

    renderCharacterList() {
        if (typeof this.app.renderCharacterList === 'function') {
            return this.app.renderCharacterList();
        }
    }

    filterCharacterList() {
        if (typeof this.app.filterCharacterList === 'function') {
            return this.app.filterCharacterList();
        }
    }

    renderBattleHistory() {
        if (typeof this.app.renderBattleHistory === 'function') {
            return this.app.renderBattleHistory();
        }
    }
}
