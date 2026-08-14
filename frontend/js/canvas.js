// 차세대 노드 기반 비주얼 에이전트 & 도구 워크플로우 캔버스 엔진 (Issue #4, #7, #8)
class WorkflowCanvas {
    constructor() {
        this.container = document.getElementById('canvasContainer');
        this.canvas = document.getElementById('workflowCanvas');
        this.nodesLayer = document.getElementById('nodesLayer');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');

        this.nodes = [];
        this.connections = []; // [{from: id, to: id}]
        this.zoom = 1.0;
        this.draggingNode = null;
        this.dragOffset = { x: 0, y: 0 };
        this.editingNodeId = null;

        this.init();
    }

    init() {
        this.initCanvasSize();
        window.addEventListener('resize', () => this.initCanvasSize());
        this.loadTemplate('fullstack');
        this.renderLines();
    }

    initCanvasSize() {
        if (!this.container || !this.canvas) return;
        this.canvas.width = this.container.clientWidth;
        this.canvas.height = this.container.clientHeight;
        this.renderLines();
    }

    // ==========================================
    // 템플릿 프리셋 로더
    // ==========================================
    loadTemplate(type) {
        if (type === 'fullstack') {
            this.nodes = [
                {
                    id: "node_1",
                    type: "agent",
                    name: "🧠 수석 기획자 (Planner)",
                    role: "요구사항 분석 & 설계",
                    system_prompt: "당신은 요구사항을 심층 분석하고 체계적인 아키텍처와 구현 계획을 설계하는 수석 기획자입니다.",
                    model: "default",
                    temperature: 0.7,
                    tools: ["web_search"],
                    x: 60,
                    y: 100
                },
                {
                    id: "node_2",
                    type: "agent",
                    name: "💻 시니어 개발자 (Coder)",
                    role: "실제 코드 구현",
                    system_prompt: "당신은 기획 내용을 바탕으로 견고하고 최적화된 실제 코드 및 산출물을 작성하는 시니어 개발자입니다.",
                    model: "default",
                    temperature: 0.3,
                    tools: ["calc_math"],
                    x: 380,
                    y: 100
                },
                {
                    id: "node_3",
                    type: "agent",
                    name: "🔍 QA 리드 (Reviewer)",
                    role: "품질 검토 & 요약",
                    system_prompt: "당신은 결과물을 엄격히 검토하여 엣지 케이스, 성능 최적화 포인트, 최종 요약 보고서를 작성하는 QA 리드입니다.",
                    model: "default",
                    temperature: 0.5,
                    tools: [],
                    x: 700,
                    y: 100
                }
            ];
            this.connections = [
                { from: "node_1", to: "node_2" },
                { from: "node_2", to: "node_3" }
            ];
        } else if (type === 'rag_qa') {
            this.nodes = [
                {
                    id: "node_rag_1",
                    type: "rag",
                    name: "📚 로컬 RAG 검색기",
                    role: "지식베이스 질의",
                    query: "최근 프로젝트 아키텍처 문서 검색",
                    x: 60,
                    y: 120
                },
                {
                    id: "node_rag_2",
                    type: "agent",
                    name: "🤖 지식 기반 답변가",
                    role: "문서 기반 Q&A",
                    system_prompt: "검색된 지식베이스 문서를 바탕으로 사용자의 질문에 정확하고 왜곡 없이 답변하세요.",
                    model: "default",
                    temperature: 0.5,
                    tools: ["web_search"],
                    x: 380,
                    y: 120
                },
                {
                    id: "node_rag_3",
                    type: "agent",
                    name: "🛡️ 팩트체커 (Verifier)",
                    role: "출처 검증",
                    system_prompt: "작성된 답변이 원본 문서와 일치하는지 환각(Hallucination) 여부를 엄격히 검증하세요.",
                    model: "default",
                    temperature: 0.2,
                    tools: [],
                    x: 700,
                    y: 120
                }
            ];
            this.connections = [
                { from: "node_rag_1", to: "node_rag_2" },
                { from: "node_rag_2", to: "node_rag_3" }
            ];
        } else if (type === 'python_runner') {
            this.nodes = [
                {
                    id: "node_py_1",
                    type: "agent",
                    name: "🐍 알고리즘 설계 에이전트",
                    role: "파이썬 코드 생성",
                    system_prompt: "사용자의 문제에 대한 완전하고 실행 가능한 파이썬 코드를 작성하세요.",
                    model: "default",
                    temperature: 0.3,
                    tools: ["calc_math"],
                    x: 60,
                    y: 100
                },
                {
                    id: "node_py_2",
                    type: "python",
                    name: "⚡ 파이썬 실행 샌드박스",
                    role: "실시간 로컬 실행기",
                    code: "import math\n\ndef get_primes(n):\n    primes = []\n    for i in range(2, n + 1):\n        if all(i % p != 0 for p in primes):\n            primes.append(i)\n    return primes\n\nprint('계산된 소수 목록:', get_primes(30))\nprint('완료!')",
                    x: 400,
                    y: 80
                },
                {
                    id: "node_py_3",
                    type: "output",
                    name: "💾 결과 리포트 내보내기",
                    role: "파일 자동 저장",
                    filename: "result_output.txt",
                    x: 780,
                    y: 120
                }
            ];
            this.connections = [
                { from: "node_py_1", to: "node_py_2" },
                { from: "node_py_2", to: "node_py_3" }
            ];
        }
        this.renderNodes();
    }

    // ==========================================
    // 노드 렌더링
    // ==========================================
    renderNodes() {
        if (!this.nodesLayer) return;
        this.nodesLayer.innerHTML = '';

        this.nodes.forEach(node => {
            const el = document.createElement('div');
            el.className = `agent-node node-type-${node.type}`;
            el.id = node.id;
            el.style.left = `${node.x}px`;
            el.style.top = `${node.y}px`;

            let bodyContent = '';
            if (node.type === 'agent') {
                const toolsBadge = (node.tools && node.tools.length > 0)
                    ? `<div style="font-size:10px; color:#38BDF8; margin-top:4px;">🛠️ 도구: ${node.tools.join(', ')}</div>`
                    : '';
                bodyContent = `
                    <div style="font-size:11px; color:var(--text-muted); margin-bottom:6px;">
                        <div><strong>Model:</strong> <span style="color:#A7F3D0;">${node.model || 'default'}</span> (T: ${node.temperature || 0.7})</div>
                        ${toolsBadge}
                        <div style="margin-top:6px; font-size:10px; color:var(--text-dim); display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">
                            ${node.system_prompt}
                        </div>
                        <button class="btn-secondary" style="width:100%; margin-top:6px; padding:3px 6px; font-size:10px; justify-content:center;" onclick="window.workflowCanvas.openConfigModal('${node.id}')">⚙️ 노드 상세 설정 자율화</button>
                    </div>
                `;
            } else if (node.type === 'python') {
                bodyContent = `
                    <div style="font-size:11px; margin-bottom:6px;">
                        <textarea class="node-input" id="code_${node.id}" style="width:100%; height:75px; font-family:'JetBrains Mono',monospace; font-size:10px; color:#38BDF8;" onchange="window.workflowCanvas.updateNodeProp('${node.id}', 'code', this.value)">${node.code || ''}</textarea>
                        <button class="btn-primary" style="width:100%; margin-top:4px; padding:4px; font-size:11px; justify-content:center;" onclick="window.workflowCanvas.runPythonNode('${node.id}')">▶ 코드 즉시 실행</button>
                        <div id="output_${node.id}" style="margin-top:6px; font-size:10px; color:#A7F3D0; font-family:'JetBrains Mono',monospace; max-height:45px; overflow-y:auto; background:rgba(0,0,0,0.4); padding:4px; border-radius:4px; display:none;"></div>
                    </div>
                `;
            } else if (node.type === 'rag') {
                bodyContent = `
                    <div style="font-size:11px; color:var(--text-muted); margin-bottom:6px;">
                        <span>검색 쿼리:</span>
                        <input type="text" class="node-input" value="${node.query || ''}" onchange="window.workflowCanvas.updateNodeProp('${node.id}', 'query', this.value)" style="width:100%; margin-top:4px; font-size:11px;">
                    </div>
                `;
            } else if (node.type === 'output') {
                bodyContent = `
                    <div style="font-size:11px; color:var(--text-muted); margin-bottom:6px;">
                        <span>저장 파일명:</span>
                        <input type="text" class="node-input" value="${node.filename || 'output.txt'}" onchange="window.workflowCanvas.updateNodeProp('${node.id}', 'filename', this.value)" style="width:100%; margin-top:4px; font-size:11px;">
                    </div>
                `;
            }

            el.innerHTML = `
                <div class="node-header">
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span class="node-title">${node.name}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:4px;">
                        <span class="node-role-badge">${node.role}</span>
                        <button onclick="window.workflowCanvas.deleteNode('${node.id}')" style="background:transparent; border:none; color:var(--text-dim); cursor:pointer; font-size:11px;">✕</button>
                    </div>
                </div>
                <div class="node-body">
                    ${bodyContent}
                </div>
            `;

            el.addEventListener('mousedown', (e) => this.onNodeMouseDown(e, node, el));
            el.addEventListener('dblclick', () => {
                if (node.type === 'agent') this.openConfigModal(node.id);
            });
            this.nodesLayer.appendChild(el);
        });

        this.renderLines();
    }

    // ==========================================
    // 노드 설정 자율화 모달 제어 (Issue #8)
    // ==========================================
    async openConfigModal(id) {
        const node = this.nodes.find(n => n.id === id);
        if (!node) return;
        this.editingNodeId = id;

        const modal = document.getElementById('nodeConfigModal');
        if (!modal) return;

        document.getElementById('cfgNodeName').value = node.name || '';
        document.getElementById('cfgNodeRole').value = node.role || '';
        document.getElementById('cfgNodePrompt').value = node.system_prompt || '';
        document.getElementById('cfgNodeTemp').value = node.temperature || 0.7;
        document.getElementById('cfgTempLabel').innerText = node.temperature || 0.7;

        // MCP 도구 목록 체크박스 렌더링
        const toolBox = document.getElementById('cfgToolCheckboxes');
        if (toolBox) {
            toolBox.innerHTML = '로딩 중...';
            try {
                const res = await fetch('/api/mcp/tools');
                const data = await res.json();
                toolBox.innerHTML = '';
                (data.tools || []).forEach(t => {
                    const isChecked = (node.tools || []).includes(t.name);
                    const label = document.createElement('label');
                    label.style.display = 'flex';
                    label.style.alignItems = 'center';
                    label.style.gap = '6px';
                    label.style.fontSize = '11px';
                    label.style.cursor = 'pointer';
                    label.innerHTML = `
                        <input type="checkbox" value="${t.name}" ${isChecked ? 'checked' : ''} class="mcp-tool-chk">
                        <span>🛠️ <strong>${t.name}</strong> (${t.server})</span>
                    `;
                    toolBox.appendChild(label);
                });
            } catch (e) {
                toolBox.innerHTML = '도구 목록 로드 실패';
            }
        }

        modal.style.display = 'flex';
    }

    saveNodeConfig() {
        if (!this.editingNodeId) return;
        const node = this.nodes.find(n => n.id === this.editingNodeId);
        if (!node) return;

        node.name = document.getElementById('cfgNodeName').value;
        node.role = document.getElementById('cfgNodeRole').value;
        node.system_prompt = document.getElementById('cfgNodePrompt').value;
        node.temperature = parseFloat(document.getElementById('cfgNodeTemp').value);

        // 체크된 도구 수집
        const chks = document.querySelectorAll('.mcp-tool-chk:checked');
        node.tools = Array.from(chks).map(c => c.value);

        this.closeConfigModal();
        this.renderNodes();
    }

    closeConfigModal() {
        const modal = document.getElementById('nodeConfigModal');
        if (modal) modal.style.display = 'none';
        this.editingNodeId = null;
    }

    updateNodeProp(id, prop, val) {
        const node = this.nodes.find(n => n.id === id);
        if (node) node[prop] = val;
    }

    async runPythonNode(id) {
        const node = this.nodes.find(n => n.id === id);
        if (!node) return;

        const code = document.getElementById(`code_${id}`)?.value || node.code;
        const outEl = document.getElementById(`output_${id}`);
        if (outEl) {
            outEl.style.display = 'block';
            outEl.innerText = '실행 중...';
        }

        try {
            const res = await fetch('/api/canvas/execute-python', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: code })
            });
            const data = await res.json();
            if (outEl) {
                outEl.innerText = data.output;
            }
        } catch (e) {
            if (outEl) outEl.innerText = `Error: ${e.message}`;
        }
    }

    deleteNode(id) {
        this.nodes = this.nodes.filter(n => n.id !== id);
        this.connections = this.connections.filter(c => c.from !== id && c.to !== id);
        this.renderNodes();
    }

    addCustomNode(type) {
        const count = this.nodes.length + 1;
        let newNode = {
            id: `node_${Date.now()}`,
            type: type,
            x: 100 + (count % 3) * 80,
            y: 120 + (count % 3) * 60
        };

        if (type === 'agent') {
            newNode.name = `🤖 Agent ${count}`;
            newNode.role = "추론 및 협업";
            newNode.system_prompt = "당신은 팀의 핵심 작업을 분담하는 전문 에이전트입니다.";
            newNode.model = "default";
            newNode.temperature = 0.7;
            newNode.tools = [];
        } else if (type === 'python') {
            newNode.name = `⚡ Python Runner ${count}`;
            newNode.role = "코드 실행기";
            newNode.code = "print('Hello from Canvas Python Sandbox!')";
        } else if (type === 'rag') {
            newNode.name = `📚 RAG Retriever ${count}`;
            newNode.role = "지식 검색기";
            newNode.query = "핵심 키워드 검색";
        } else if (type === 'output') {
            newNode.name = `💾 Output File ${count}`;
            newNode.role = "결과 내보내기";
            newNode.filename = `report_${count}.txt`;
        }

        if (this.nodes.length > 0) {
            const last = this.nodes[this.nodes.length - 1];
            this.connections.push({ from: last.id, to: newNode.id });
        }

        this.nodes.push(newNode);
        this.renderNodes();
    }

    onNodeMouseDown(e, node, el) {
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        this.draggingNode = node;
        this.dragOffset = {
            x: e.clientX - node.x,
            y: e.clientY - node.y
        };

        const onMouseMove = (moveEvent) => {
            if (!this.draggingNode) return;
            this.draggingNode.x = moveEvent.clientX - this.dragOffset.x;
            this.draggingNode.y = moveEvent.clientY - this.dragOffset.y;
            el.style.left = `${this.draggingNode.x}px`;
            el.style.top = `${this.draggingNode.y}px`;
            this.renderLines();
        };

        const onMouseUp = () => {
            this.draggingNode = null;
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }

    renderLines() {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.connections.forEach(conn => {
            const fromNode = this.nodes.find(n => n.id === conn.from);
            const toNode = this.nodes.find(n => n.id === conn.to);
            if (!fromNode || !toNode) return;

            const nodeW = 240;
            const startX = fromNode.x + nodeW;
            const startY = fromNode.y + 45;
            const endX = toNode.x;
            const endY = toNode.y + 45;

            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.moveTo(startX, startY);

            const cp1X = startX + (endX - startX) / 2;
            const cp1Y = startY;
            const cp2X = startX + (endX - startX) / 2;
            const cp2Y = endY;

            this.ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, endX, endY);
            this.ctx.strokeStyle = '#6366F1';
            this.ctx.lineWidth = 2.5;
            this.ctx.stroke();

            // 화살표 헤드
            this.ctx.fillStyle = '#6366F1';
            this.ctx.beginPath();
            this.ctx.arc(endX, endY, 5, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        });
    }

    getPipelineAgents() {
        return this.nodes.filter(n => n.type === 'agent').map(n => ({
            name: n.name,
            role: n.role,
            system_prompt: n.system_prompt,
            model: n.model,
            temperature: n.temperature,
            tools: n.tools || []
        }));
    }
}

window.workflowCanvas = new WorkflowCanvas();
