// 지속적 자가 학습 및 메모리 큐 매니저 (Issue #2)
class SelfLearningManager {
    constructor() {
        this.memoryListEl = document.getElementById('selfLearningList');
        this.totalMemoryCountEl = document.getElementById('totalMemoryCount');
    }

    async refresh() {
        try {
            const res = await fetch('/api/brain/graph');
            const data = await res.json();
            this.render(data.nodes || []);
        } catch (e) {
            console.error("Self learning load error:", e);
        }
    }

    render(memories) {
        if (this.totalMemoryCountEl) {
            this.totalMemoryCountEl.innerText = `${memories.length}개의 지식 시냅스 축적됨`;
        }

        if (!this.memoryListEl) return;
        this.memoryListEl.innerHTML = '';

        if (memories.length === 0) {
            this.memoryListEl.innerHTML = '<div style="color:var(--text-dim); font-size:12px;">아직 축적된 자가 학습 메모리가 없습니다. 대화를 나누면 자동으로 생성됩니다.</div>';
            return;
        }

        memories.forEach(m => {
            const el = document.createElement('div');
            el.className = 'agent-msg-card';
            el.style.background = 'rgba(15, 23, 42, 0.7)';
            el.innerHTML = `
                <div class="agent-msg-header">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${m.color};"></span>
                        <strong style="font-size:13px;">${m.title}</strong>
                    </div>
                    <span class="node-role-badge">중요도: ${m.importance}</span>
                </div>
                <div class="msg-content" style="font-size:12px; color:var(--text-muted);">${m.content}</div>
            `;
            this.memoryListEl.appendChild(el);
        });
    }

    async consolidate() {
        try {
            const res = await fetch('/api/brain/consolidate', { method: 'POST' });
            const data = await res.json();
            alert(`🎉 ${data.message}`);
            this.refresh();
            if (window.brainVisualizer) {
                window.brainVisualizer.loadGraphData();
            }
        } catch (e) {
            alert(`압축 실패: ${e.message}`);
        }
    }

    async addManualKnowledge() {
        const title = prompt("추가할 지식의 제목/개념을 입력하세요:");
        if (!title) return;
        const content = prompt("상세 설명/규칙을 입력하세요:");
        if (!content) return;

        try {
            await fetch('/api/brain/memory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: title,
                    content: content,
                    category: 'general',
                    importance: 0.9
                })
            });
            alert("자가 학습 뇌 지식에 성공적으로 등록되었습니다!");
            this.refresh();
            if (window.brainVisualizer) {
                window.brainVisualizer.loadGraphData();
            }
        } catch (e) {
            alert(`등록 실패: ${e.message}`);
        }
    }
}

window.selfLearning = new SelfLearningManager();
