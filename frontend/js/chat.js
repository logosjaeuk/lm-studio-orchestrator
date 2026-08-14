// 멀티 에이전트 스트리밍 채팅 매니저
class ChatManager {
    constructor() {
        this.messagesList = document.getElementById('messagesList');
        this.promptInput = document.getElementById('promptInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.mode = 'sequential'; // 'sequential' or 'debate'
        this.currentCardContent = null;
    }

    setMode(mode) {
        this.mode = mode;
        document.getElementById('modeSeq').classList.toggle('active', mode === 'sequential');
        document.getElementById('modeDebate').classList.toggle('active', mode === 'debate');
    }

    appendUserMessage(text) {
        const card = document.createElement('div');
        card.className = 'agent-msg-card';
        card.style.background = 'rgba(99, 102, 241, 0.08)';
        card.style.borderColor = 'rgba(99, 102, 241, 0.3)';

        card.innerHTML = `
            <div class="agent-msg-header">
                <div class="agent-info">
                    <span>👤</span>
                    <span>사용자 요청 (${this.mode === 'sequential' ? '순차 파이프라인' : '토론 아레나'})</span>
                </div>
            </div>
            <div class="msg-content">${this.escapeHTML(text)}</div>
        `;
        this.messagesList.appendChild(card);
        this.scrollToBottom();
    }

    createAgentCard(agentName, role) {
        const card = document.createElement('div');
        card.className = 'agent-msg-card';

        card.innerHTML = `
            <div class="agent-msg-header">
                <div class="agent-info">
                    <span>⚡</span>
                    <span>${this.escapeHTML(agentName)}</span>
                </div>
                <span class="node-role-badge">${this.escapeHTML(role)}</span>
            </div>
            <div class="msg-content" id="streamTarget"></div>
        `;
        this.messagesList.appendChild(card);
        this.currentCardContent = card.querySelector('#streamTarget');
        this.currentCardContent.removeAttribute('id');
        this.scrollToBottom();
    }

    appendToken(delta) {
        if (this.currentCardContent) {
            this.currentCardContent.textContent += delta;
            this.scrollToBottom();
        }
    }

    scrollToBottom() {
        this.messagesList.scrollTop = this.messagesList.scrollHeight;
    }

    escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }
}

window.chatManager = new ChatManager();
