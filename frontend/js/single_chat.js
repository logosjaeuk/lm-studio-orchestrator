// 1:1 싱글 챗 플레이그라운드 매니저 (Issue #1)
class SingleChatManager {
    constructor() {
        this.sessions = JSON.parse(localStorage.getItem('single_chat_sessions') || '[]');
        this.currentSessionId = null;
        this.messages = [];
        this.isStreaming = false;

        this.chatMessagesEl = document.getElementById('singleChatMessages');
        this.inputEl = document.getElementById('singleChatInput');
        this.sendBtn = document.getElementById('singleSendBtn');
        this.sessionListEl = document.getElementById('chatSessionList');
        this.tpsBadge = document.getElementById('tpsBadge');
        this.presetSelect = document.getElementById('presetSelect');

        this.init();
    }

    init() {
        this.loadPresets();
        if (this.sessions.length === 0) {
            this.createNewSession();
        } else {
            this.switchSession(this.sessions[0].id);
        }
        this.renderSessionList();
    }

    async loadPresets() {
        try {
            const res = await fetch('/api/presets');
            const presets = await res.json();
            if (this.presetSelect) {
                this.presetSelect.innerHTML = '';
                presets.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p.prompt;
                    opt.innerText = p.name;
                    this.presetSelect.appendChild(opt);
                });
            }
        } catch (e) {
            console.error("Presets load error:", e);
        }
    }

    createNewSession() {
        const id = `session_${Date.now()}`;
        const newSession = {
            id: id,
            title: "새로운 대화",
            messages: [],
            createdAt: new Date().toLocaleTimeString()
        };
        this.sessions.unshift(newSession);
        this.saveSessions();
        this.switchSession(id);
        this.renderSessionList();
    }

    switchSession(id) {
        this.currentSessionId = id;
        const session = this.sessions.find(s => s.id === id);
        if (session) {
            this.messages = session.messages || [];
            this.renderMessages();
        }
        this.renderSessionList();
    }

    saveSessions() {
        localStorage.setItem('single_chat_sessions', JSON.stringify(this.sessions));
    }

    renderSessionList() {
        if (!this.sessionListEl) return;
        this.sessionListEl.innerHTML = '';
        this.sessions.forEach(s => {
            const el = document.createElement('div');
            el.className = `session-item ${s.id === this.currentSessionId ? 'active' : ''}`;
            el.innerHTML = `
                <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    💬 ${s.title}
                </div>
                <button onclick="event.stopPropagation(); window.singleChat.deleteSession('${s.id}')" style="background:transparent; border:none; color:var(--text-dim); cursor:pointer; font-size:11px;">✕</button>
            `;
            el.onclick = () => this.switchSession(s.id);
            this.sessionListEl.appendChild(el);
        });
    }

    deleteSession(id) {
        this.sessions = this.sessions.filter(s => s.id !== id);
        this.saveSessions();
        if (this.sessions.length === 0) {
            this.createNewSession();
        } else if (this.currentSessionId === id) {
            this.switchSession(this.sessions[0].id);
        }
        this.renderSessionList();
    }

    renderMessages() {
        if (!this.chatMessagesEl) return;
        this.chatMessagesEl.innerHTML = '';
        
        if (this.messages.length === 0) {
            this.chatMessagesEl.innerHTML = `
                <div class="agent-msg-card" style="margin: auto; max-width: 450px; text-align: center; background: rgba(255,255,255,0.03);">
                    <div style="font-size: 32px; margin-bottom: 10px;">💬</div>
                    <div style="font-weight: 700; font-size: 15px; margin-bottom: 6px;">1:1 로컬 LLM 플레이그라운드</div>
                    <div style="font-size: 12px; color: var(--text-muted);">
                        LM Studio 로컬 모델과 1:1로 빠르게 대화하고 실시간 생성 속도(t/s)를 측정할 수 있습니다.
                    </div>
                </div>
            `;
            return;
        }

        this.messages.forEach(m => {
            const card = document.createElement('div');
            card.className = 'agent-msg-card';
            const isUser = m.role === 'user';
            if (isUser) {
                card.style.background = 'rgba(99, 102, 241, 0.08)';
                card.style.borderColor = 'rgba(99, 102, 241, 0.3)';
            }
            card.innerHTML = `
                <div class="agent-msg-header">
                    <div class="agent-info">
                        <span>${isUser ? '👤 사용자' : '🤖 로컬 LLM'}</span>
                    </div>
                </div>
                <div class="msg-content">${this.renderMarkdown(m.content)}</div>
            `;
            this.chatMessagesEl.appendChild(card);
        });
        this.scrollToBottom();
    }

    async sendMessage() {
        const text = this.inputEl.value.trim();
        if (!text || this.isStreaming) return;

        this.inputEl.value = '';
        this.messages.push({ role: 'user', content: text });
        
        // 세션 제목 자동 업데이트
        const currentSession = this.sessions.find(s => s.id === this.currentSessionId);
        if (currentSession && currentSession.title === "새로운 대화") {
            currentSession.title = text.slice(0, 20);
            this.renderSessionList();
        }

        this.renderMessages();

        const model = document.getElementById('modelSelect').value;
        const systemPrompt = this.presetSelect ? this.presetSelect.value : "";
        const useRag = document.getElementById('singleRagToggle')?.checked || false;

        // 어시스턴트 카드 생성
        const assistantCard = document.createElement('div');
        assistantCard.className = 'agent-msg-card';
        assistantCard.innerHTML = `
            <div class="agent-msg-header">
                <div class="agent-info"><span>🤖 로컬 LLM</span></div>
                <span class="node-role-badge" id="liveSpeed">0.0 t/s</span>
            </div>
            <div class="msg-content" id="liveReply"></div>
        `;
        this.chatMessagesEl.appendChild(assistantCard);
        this.scrollToBottom();

        const replyTarget = assistantCard.querySelector('#liveReply');
        const speedTarget = assistantCard.querySelector('#liveSpeed');
        let fullReply = '';
        this.isStreaming = true;
        this.sendBtn.disabled = true;

        try {
            const response = await fetch('/api/single-chat/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: this.messages,
                    model: model,
                    system_prompt: systemPrompt,
                    use_rag: useRag,
                    auto_learn: true
                })
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const raw = line.slice(6).trim();
                        if (raw === '[DONE]') break;
                        try {
                            const data = JSON.parse(raw);
                            if (data.delta) {
                                fullReply += data.delta;
                                replyTarget.innerHTML = this.renderMarkdown(fullReply);
                                if (data.tps && speedTarget) {
                                    speedTarget.innerText = `⚡ ${data.tps} t/s (${data.elapsed}s)`;
                                }
                                this.scrollToBottom();
                            }
                        } catch (e) {}
                    }
                }
            }

            this.messages.push({ role: 'assistant', content: fullReply });
            if (currentSession) {
                currentSession.messages = this.messages;
                this.saveSessions();
            }

            // 3D 브레인 비주얼라이저에 새 지식 펄스 전달
            if (window.brainVisualizer) {
                window.brainVisualizer.pulseRandomNeuron();
            }

        } catch (err) {
            replyTarget.innerHTML = `<span style="color:#EF4444;">오류 발생: ${err.message}</span>`;
        } finally {
            this.isStreaming = false;
            this.sendBtn.disabled = false;
        }
    }

    renderMarkdown(text) {
        let escaped = text.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
        // 코드 블록 변환
        escaped = escaped.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
            return `<pre><div style="display:flex; justify-content:space-between; color:#94A3B8; font-size:11px; margin-bottom:4px;"><span>${lang || 'code'}</span><button onclick="navigator.clipboard.writeText(this.parentElement.nextElementSibling.innerText); alert('복사됨!');" style="background:transparent; border:none; color:#38BDF8; cursor:pointer;">복사</button></div><code>${code}</code></pre>`;
        });
        return escaped;
    }

    scrollToBottom() {
        if (this.chatMessagesEl) {
            this.chatMessagesEl.scrollTop = this.chatMessagesEl.scrollHeight;
        }
    }
}

window.singleChat = new SingleChatManager();
