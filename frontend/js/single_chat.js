// 1:1 싱글 챗 플레이그라운드 클라이언트 엔진 (Issue #1, #6)
class SingleChat {
    constructor() {
        this.sessions = JSON.parse(localStorage.getItem('single_chat_sessions') || '[]');
        this.currentSessionId = null;
        this.isStreaming = false;
        this.abortController = null;

        this.messagesContainer = document.getElementById('singleChatMessages');
        this.sessionListContainer = document.getElementById('chatSessionList');
        this.inputArea = document.getElementById('singleChatInput');
        this.sendBtn = document.getElementById('singleSendBtn');
        this.stopBtn = document.getElementById('singleStopBtn');
        this.tpsBadge = document.getElementById('tpsBadge');
        this.presetSelect = document.getElementById('presetSelect');
        this.ragToggle = document.getElementById('singleRagToggle');

        this.init();
    }

    async init() {
        await this.loadPresets();
        if (this.sessions.length === 0) {
            this.createNewSession();
        } else {
            this.switchSession(this.sessions[0].id);
        }
        this.renderSessionList();
    }

    async loadPresets() {
        if (!this.presetSelect) return;
        try {
            const res = await fetch('/api/presets');
            const presets = await res.json();
            this.presetSelect.innerHTML = '';
            presets.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.prompt;
                opt.innerText = p.name;
                this.presetSelect.appendChild(opt);
            });
        } catch (e) {
            console.error('프리셋 로드 오류:', e);
        }
    }

    saveSessions() {
        localStorage.setItem('single_chat_sessions', JSON.stringify(this.sessions));
    }

    createNewSession() {
        const newSession = {
            id: `session_${Date.now()}`,
            title: `새 대화 ${this.sessions.length + 1}`,
            messages: [
                { role: "assistant", content: "안녕하세요! 어떤 도움이 필요하신가요?" }
            ],
            createdAt: new Date().toISOString()
        };
        this.sessions.unshift(newSession);
        this.saveSessions();
        this.switchSession(newSession.id);
        this.renderSessionList();
    }

    switchSession(id) {
        this.currentSessionId = id;
        this.renderMessages();
        this.renderSessionList();
    }

    getCurrentSession() {
        return this.sessions.find(s => s.id === this.currentSessionId);
    }

    renderSessionList() {
        if (!this.sessionListContainer) return;
        this.sessionListContainer.innerHTML = '';
        this.sessions.forEach(s => {
            const item = document.createElement('div');
            item.className = `session-item ${s.id === this.currentSessionId ? 'active' : ''}`;
            item.innerHTML = `
                <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:140px;">💬 ${s.title}</span>
                <button onclick="event.stopPropagation(); window.singleChat.deleteSession('${s.id}')" style="background:transparent; border:none; color:var(--text-dim); cursor:pointer; font-size:11px;">✕</button>
            `;
            item.onclick = () => this.switchSession(s.id);
            this.sessionListContainer.appendChild(item);
        });
    }

    deleteSession(id) {
        this.sessions = this.sessions.filter(s => s.id !== id);
        this.saveSessions();
        if (this.currentSessionId === id && this.sessions.length > 0) {
            this.switchSession(this.sessions[0].id);
        } else if (this.sessions.length === 0) {
            this.createNewSession();
        } else {
            this.renderSessionList();
        }
    }

    renderMessages() {
        if (!this.messagesContainer) return;
        this.messagesContainer.innerHTML = '';
        const session = this.getCurrentSession();
        if (!session) return;

        session.messages.forEach(msg => {
            const card = document.createElement('div');
            card.className = 'agent-msg-card';
            const isUser = msg.role === 'user';
            card.innerHTML = `
                <div class="agent-msg-header">
                    <div class="agent-info">
                        <span>${isUser ? '👤' : '🤖'}</span>
                        <span>${isUser ? '나 (User)' : 'Local LLM'}</span>
                    </div>
                    <span class="node-role-badge">${isUser ? '사용자' : '어시스턴트'}</span>
                </div>
                <div class="msg-content">${msg.content}</div>
            `;
            this.messagesContainer.appendChild(card);
        });
        this.scrollToBottom();
    }

    scrollToBottom() {
        if (this.messagesContainer) {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }
    }

    stopGeneration() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        this.setStreamingState(false);
        this.saveSessions();
    }

    setStreamingState(streaming) {
        this.isStreaming = streaming;
        if (this.sendBtn) this.sendBtn.style.display = streaming ? 'none' : 'flex';
        if (this.stopBtn) this.stopBtn.style.display = streaming ? 'flex' : 'none';
        if (this.inputArea) this.inputArea.disabled = streaming;
    }

    async sendMessage() {
        if (this.isStreaming || !this.inputArea) return;
        const text = this.inputArea.value.trim();
        if (!text) return;

        const session = this.getCurrentSession();
        if (!session) return;

        // 첫 질문일 경우 세션 타이틀 업데이트
        if (session.messages.length <= 1) {
            session.title = text.slice(0, 18) + '...';
            this.renderSessionList();
        }

        session.messages.push({ role: "user", content: text });
        this.inputArea.value = '';
        this.renderMessages();

        // 어시스턴트 빈 메시지 카드 추가
        const card = document.createElement('div');
        card.className = 'agent-msg-card';
        card.innerHTML = `
            <div class="agent-msg-header">
                <div class="agent-info"><span>🤖</span><span>Local LLM</span></div>
                <span class="node-role-badge">생성 중...</span>
            </div>
            <div class="msg-content" id="singleCurrentStream"></div>
        `;
        this.messagesContainer.appendChild(card);
        this.scrollToBottom();

        const streamTarget = document.getElementById('singleCurrentStream');
        let fullReply = '';
        this.setStreamingState(true);
        this.abortController = new AbortController();

        try {
            const systemPrompt = this.presetSelect ? this.presetSelect.value : "";
            const useRag = this.ragToggle ? this.ragToggle.checked : false;

            const res = await fetch('/api/single-chat/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: this.abortController.signal,
                body: JSON.stringify({
                    messages: session.messages.filter(m => m.role !== 'system'),
                    system_prompt: systemPrompt,
                    use_rag: useRag,
                    auto_learn: true
                })
            });

            const reader = res.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.replace('data: ', '').trim();
                        if (dataStr === '[DONE]') continue;
                        try {
                            const data = JSON.parse(dataStr);
                            if (data.type === 'token') {
                                fullReply += data.delta;
                                if (streamTarget) streamTarget.innerText = fullReply;
                                if (this.tpsBadge && data.tps) {
                                    this.tpsBadge.innerText = `⚡ ${data.tps} t/s (${data.elapsed}s)`;
                                }
                                this.scrollToBottom();
                            }
                        } catch (e) {}
                    }
                }
            }

            session.messages.push({ role: "assistant", content: fullReply });
            this.saveSessions();
            if (window.brainVisualizer) window.brainVisualizer.loadGraph();
        } catch (e) {
            if (e.name === 'AbortError') {
                if (streamTarget) streamTarget.innerText = fullReply + "\n\n[⏹️ 사용자에 의해 생성이 중단되었습니다]";
                session.messages.push({ role: "assistant", content: fullReply });
                this.saveSessions();
            } else {
                if (streamTarget) streamTarget.innerText = `오류 발생: ${e.message}`;
            }
        } finally {
            this.setStreamingState(false);
            this.abortController = null;
        }
    }
}

window.singleChat = new SingleChat();
