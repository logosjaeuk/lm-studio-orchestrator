// RAG 지식베이스 UI 매니저
class RAGManager {
    constructor() {
        this.fileListEl = document.getElementById('ragFileList');
        this.searchResultsEl = document.getElementById('ragSearchResults');
    }

    async refreshStats() {
        try {
            const stats = await window.apiClient.getRAGStats();
            this.renderFileList(stats.files || []);
        } catch (e) {
            console.error("RAG stats error:", e);
        }
    }

    renderFileList(files) {
        if (!this.fileListEl) return;
        if (files.length === 0) {
            this.fileListEl.innerHTML = '<div style="color: var(--text-dim); font-size: 12px;">등록된 문서가 없습니다.</div>';
            return;
        }

        this.fileListEl.innerHTML = '';
        files.forEach(f => {
            const el = document.createElement('div');
            el.className = 'file-item';
            el.innerHTML = `
                <span style="font-weight: 600;">📄 ${f}</span>
                <span style="font-size: 10px; color: var(--accent-green);">인덱싱됨</span>
            `;
            this.fileListEl.appendChild(el);
        });
    }

    async uploadFile(file) {
        try {
            const res = await window.apiClient.uploadRAGDoc(file);
            alert(`문서 [${res.filename}]이(가) ${res.chunks_added}개의 청크로 지식베이스에 성공적으로 등록되었습니다!`);
            this.refreshStats();
        } catch (e) {
            alert(`업로드 실패: ${e.message}`);
        }
    }

    async search(query) {
        if (!query) return;
        try {
            const data = await window.apiClient.searchRAG(query);
            this.renderSearchResults(data.results || []);
        } catch (e) {
            console.error("RAG search error:", e);
        }
    }

    renderSearchResults(results) {
        if (!this.searchResultsEl) return;
        if (results.length === 0) {
            this.searchResultsEl.innerHTML = '<div style="color: var(--text-dim); font-size: 12px;">검색 결과가 없습니다.</div>';
            return;
        }

        this.searchResultsEl.innerHTML = '';
        results.forEach(r => {
            const card = document.createElement('div');
            card.className = 'agent-msg-card';
            card.style.background = 'rgba(6, 182, 212, 0.06)';
            card.style.borderColor = 'rgba(6, 182, 212, 0.25)';

            card.innerHTML = `
                <div class="agent-msg-header">
                    <span style="font-size: 12px; font-weight: 700; color: var(--accent-cyan);">📄 ${r.filename} (청크 #${r.chunk_index})</span>
                    <span class="node-role-badge">관련도: ${r.score}</span>
                </div>
                <div class="msg-content" style="font-size: 12px;">${r.text}</div>
            `;
            this.searchResultsEl.appendChild(card);
        });
    }
}

window.ragManager = new RAGManager();
