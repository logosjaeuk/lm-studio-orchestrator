// LM Studio Orchestrator 메인 앱 컨트롤러

function switchView(viewId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    const targetView = document.getElementById(viewId);
    if (targetView) targetView.classList.add('active');

    // 네비게이션 액티브 갱신
    const navMap = {
        'canvasView': 0,
        'chatView': 1,
        'ragView': 2,
        'datasetView': 3
    };
    const navItems = document.querySelectorAll('.nav-item');
    if (navItems[navMap[viewId]]) {
        navItems[navMap[viewId]].classList.add('active');
    }

    if (viewId === 'canvasView' && window.workflowCanvas) {
        setTimeout(() => window.workflowCanvas.initCanvasSize(), 50);
    }
    if (viewId === 'ragView' && window.ragManager) {
        window.ragManager.refreshStats();
    }
}

async function checkServerHealth() {
    const badge = document.getElementById('lmStatusBadge');
    const text = document.getElementById('lmStatusText');
    const select = document.getElementById('modelSelect');

    try {
        const data = await window.apiClient.getHealth();
        if (data.connected) {
            badge.classList.remove('offline');
            text.innerText = `LM Studio 온라인 (${data.models.length}개 모델)`;
            select.innerHTML = '';
            data.models.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m;
                opt.innerText = m;
                select.appendChild(opt);
            });
        } else {
            badge.classList.add('offline');
            text.innerText = `LM Studio 오프라인 (시뮬레이션 모드)`;
            select.innerHTML = '<option value="mock-qwen-2.5">Qwen 2.5 7B (Simulation)</option><option value="mock-llama-3.1">Llama 3.1 8B (Simulation)</option>';
        }
    } catch (e) {
        badge.classList.add('offline');
        text.innerText = `서버 연결 실패`;
    }
}

function setMode(mode) {
    window.chatManager.setMode(mode);
}

async function startOrchestration() {
    const promptInput = document.getElementById('promptInput');
    const text = promptInput.value.trim();
    if (!text) return;

    const useRAG = document.getElementById('ragToggle').checked;
    const model = document.getElementById('modelSelect').value;
    const mode = window.chatManager.mode;

    window.chatManager.appendUserMessage(text);
    promptInput.value = '';

    const payload = {
        mode: mode,
        user_input: text,
        agents: window.workflowCanvas ? window.workflowCanvas.getPipelineAgents() : [],
        use_rag: useRAG,
        model: model
    };

    const sendBtn = document.getElementById('sendBtn');
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<span>생성 중...</span>';

    await window.apiClient.streamPipeline(
        payload,
        (ev) => {
            if (ev.type === 'step_start') {
                window.chatManager.createAgentCard(ev.agent, ev.role);
            } else if (ev.type === 'token') {
                window.chatManager.appendToken(ev.delta);
            }
        },
        () => {
            sendBtn.disabled = false;
            sendBtn.innerHTML = '<span>실행</span><span>➔</span>';
        },
        (err) => {
            alert(`오케스트레이션 에러: ${err.message}`);
            sendBtn.disabled = false;
            sendBtn.innerHTML = '<span>실행</span><span>➔</span>';
        }
    );
}

function runCanvasWorkflow() {
    switchView('chatView');
    const promptInput = document.getElementById('promptInput');
    if (!promptInput.value.trim()) {
        promptInput.value = "설계된 에이전트 캔버스 파이프라인을 실행합니다.";
    }
    startOrchestration();
}

function addAgentNode() {
    if (window.workflowCanvas) window.workflowCanvas.addNode();
}

function resetCanvas() {
    if (window.workflowCanvas) window.workflowCanvas.setupDefaultTemplate();
}

function clearChat() {
    const list = document.getElementById('messagesList');
    list.innerHTML = `
        <div class="agent-msg-card">
            <div class="agent-msg-header">
                <div class="agent-info"><span>🤖</span><span>LM Studio Orchestrator</span></div>
                <span class="node-role-badge">시스템</span>
            </div>
            <div class="msg-content">대화 기록이 초기화되었습니다. 새로운 과업을 시작하세요!</div>
        </div>
    `;
}

// RAG 관련
function handleFileUpload(e) {
    const file = e.target.files[0];
    if (file && window.ragManager) {
        window.ragManager.uploadFile(file);
    }
}

function testRAGSearch() {
    const q = document.getElementById('ragSearchInput').value.trim();
    if (q && window.ragManager) {
        window.ragManager.search(q);
    }
}

async function clearKnowledgeBase() {
    if (confirm("정말 모든 로컬 RAG 지식베이스 문서를 삭제하시겠습니까?")) {
        await window.apiClient.clearRAG();
        if (window.ragManager) window.ragManager.refreshStats();
    }
}

// Dataset & LoRA 관련
async function addManualDataset() {
    const inst = document.getElementById('dsInstruction').value.trim();
    const inp = document.getElementById('dsInput').value.trim();
    const out = document.getElementById('dsOutput').value.trim();

    if (!inst || !out) {
        alert("Instruction과 Output은 필수 입력값입니다.");
        return;
    }

    const res = await window.apiClient.addDataset({
        instruction: inst,
        context_input: inp,
        output: out
    });

    document.getElementById('dsCountLabel').innerText = `수집된 데이터셋: ${res.total_entries} 건`;
    document.getElementById('dsInstruction').value = '';
    document.getElementById('dsInput').value = '';
    document.getElementById('dsOutput').value = '';
    alert("데이터셋에 추가되었습니다!");
}

async function exportDatasetFormat(format) {
    const data = await window.apiClient.exportDataset(format);
    document.getElementById('codePreview').value = data.data;
}

async function generateUnslothScript() {
    const model = document.getElementById('modelSelect').value || "unsloth/Qwen2.5-7B-Instruct-bnb-4bit";
    const res = await window.apiClient.generateTrainingScript({
        base_model: model,
        epochs: 3,
        lora_r: 16,
        learning_rate: 2e-4
    });
    document.getElementById('codePreview').value = res.script;
}

function copyCodePreview() {
    const area = document.getElementById('codePreview');
    area.select();
    document.execCommand('copy');
    alert("클립보드에 복사되었습니다!");
}

function exportToDataset() {
    switchView('datasetView');
    exportDatasetFormat('alpaca');
}

// 시작 시 초기화
window.addEventListener('DOMContentLoaded', () => {
    checkServerHealth();
    setInterval(checkServerHealth, 15000); // 15초마다 헬스체크 갱신
});
