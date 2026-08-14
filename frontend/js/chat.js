// 멀티 에이전트 실시간 오케스트레이션 릴레이 & 토론 UI 컨트롤러 (Issue #6, #7)
let currentMode = "sequential";
let debateRounds = 2;
let orchestratorAbortController = null;

function setMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.pill-option').forEach(el => el.classList.remove('active'));
    if (mode === 'sequential') {
        document.getElementById('modeSeq')?.classList.add('active');
    } else {
        document.getElementById('modeDebate')?.classList.add('active');
    }
}

function clearChat() {
    const list = document.getElementById('messagesList');
    if (list) {
        list.innerHTML = `
            <div class="agent-msg-card">
                <div class="agent-msg-header">
                    <div class="agent-info"><span>🤖</span><span>LM Studio Orchestrator</span></div>
                    <span class="node-role-badge">시스템</span>
                </div>
                <div class="msg-content">대화가 초기화되었습니다. 새로운 과업이나 토론 주제를 입력하세요.</div>
            </div>
        `;
    }
}

function stopOrchestration() {
    if (orchestratorAbortController) {
        orchestratorAbortController.abort();
        orchestratorAbortController = null;
    }
    setOrchestrationState(false);
}

function setOrchestrationState(running) {
    const sendBtn = document.getElementById('sendBtn');
    const stopBtn = document.getElementById('stopOrchestrateBtn');
    const promptInput = document.getElementById('promptInput');
    if (sendBtn) sendBtn.style.display = running ? 'none' : 'flex';
    if (stopBtn) stopBtn.style.display = running ? 'flex' : 'none';
    if (promptInput) promptInput.disabled = running;
}

async function startOrchestration() {
    const input = document.getElementById('promptInput');
    const text = input ? input.value.trim() : "";
    if (!text) return;

    input.value = "";
    const list = document.getElementById('messagesList');

    // 사용자 요청 카드 추가
    const userCard = document.createElement('div');
    userCard.className = 'agent-msg-card';
    userCard.innerHTML = `
        <div class="agent-msg-header">
            <div class="agent-info"><span>👤</span><span>과업 지시자 (User)</span></div>
            <span class="node-role-badge">프로젝트 오너</span>
        </div>
        <div class="msg-content">${text}</div>
    `;
    list.appendChild(userCard);

    // 캔버스에 구성된 에이전트 목록 가져오기 (각 노드별 도구 및 커스텀 프롬프트 포함)
    let agents = [];
    if (window.workflowCanvas) {
        agents = window.workflowCanvas.getPipelineAgents();
    }

    const useRag = document.getElementById('ragToggle')?.checked || false;
    const model = document.getElementById('modelSelect')?.value || "default";

    setOrchestrationState(true);
    orchestratorAbortController = new AbortController();

    try {
        const res = await fetch('/api/orchestrate/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: orchestratorAbortController.signal,
            body: JSON.stringify({
                mode: currentMode,
                user_input: text,
                agents: agents,
                use_rag: useRag,
                model: model,
                debate_rounds: debateRounds
            })
        });

        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let currentCard = null;
        let currentContentEl = null;
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
                        const event = JSON.parse(dataStr);
                        if (event.type === 'step_start') {
                            currentCard = document.createElement('div');
                            currentCard.className = 'agent-msg-card';
                            currentCard.innerHTML = `
                                <div class="agent-msg-header">
                                    <div class="agent-info"><span>🤖</span><span>${event.agent}</span></div>
                                    <span class="node-role-badge">${event.role || ''}</span>
                                </div>
                                <div class="msg-content"></div>
                            `;
                            list.appendChild(currentCard);
                            currentContentEl = currentCard.querySelector('.msg-content');
                            list.scrollTop = list.scrollHeight;
                        } else if (event.type === 'token' && currentContentEl) {
                            currentContentEl.innerText += event.delta;
                            list.scrollTop = list.scrollHeight;
                        }
                    } catch (e) {}
                }
            }
        }
    } catch (e) {
        if (e.name === 'AbortError') {
            const abortNotice = document.createElement('div');
            abortNotice.style.fontSize = '11px';
            abortNotice.style.color = '#F59E0B';
            abortNotice.style.padding = '6px';
            abortNotice.innerText = '⏹️ 사용자에 의해 오케스트레이션이 중단되었습니다.';
            list.appendChild(abortNotice);
        } else {
            console.error('오케스트레이션 오류:', e);
        }
    } finally {
        setOrchestrationState(false);
        orchestratorAbortController = null;
    }
}
