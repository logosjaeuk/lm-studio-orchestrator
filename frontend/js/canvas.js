// 노드 기반 비주얼 에이전트 워크플로우 캔버스 엔진
class WorkflowCanvas {
    constructor() {
        this.container = document.getElementById('canvasContainer');
        this.canvas = document.getElementById('workflowCanvas');
        this.nodesLayer = document.getElementById('nodesLayer');
        this.ctx = this.canvas.getContext('2d');
        this.nodes = [];
        this.connections = []; // [{from: id, to: id}]
        this.draggingNode = null;
        this.dragOffset = { x: 0, y: 0 };

        this.initCanvasSize();
        window.addEventListener('resize', () => this.initCanvasSize());
        this.setupDefaultTemplate();
        this.renderLines();
    }

    initCanvasSize() {
        if (!this.container) return;
        this.canvas.width = this.container.clientWidth;
        this.canvas.height = this.container.clientHeight;
        this.renderLines();
    }

    setupDefaultTemplate() {
        this.nodes = [
            {
                id: "node_1",
                name: "🧠 수석 기획자 (Planner)",
                role: "요구사항 분석 & 설계",
                system_prompt: "당신은 사용자의 요구사항을 심층 분석하고 체계적인 구현 전략과 기술 아키텍처를 설계하는 수석 기획자입니다.",
                x: 60,
                y: 120
            },
            {
                id: "node_2",
                name: "💻 시니어 개발자 (Coder)",
                role: "실제 코드 구현",
                system_prompt: "당신은 기획 내용을 바탕으로 견고하고 최적화된 실제 코드 및 산출물을 작성하는 시니어 개발자입니다.",
                x: 360,
                y: 120
            },
            {
                id: "node_3",
                name: "🔍 QA 리드 (Reviewer)",
                role: "품질 검토 & 종합 요약",
                system_prompt: "당신은 결과물을 엄격히 검토하여 엣지 케이스, 성능 최적화 포인트, 최종 요약 보고서를 작성하는 QA 리드입니다.",
                x: 660,
                y: 120
            }
        ];

        this.connections = [
            { from: "node_1", to: "node_2" },
            { from: "node_2", to: "node_3" }
        ];

        this.renderNodes();
    }

    renderNodes() {
        this.nodesLayer.innerHTML = '';
        this.nodes.forEach(node => {
            const el = document.createElement('div');
            el.className = 'agent-node';
            el.id = node.id;
            el.style.left = `${node.x}px`;
            el.style.top = `${node.y}px`;

            el.innerHTML = `
                <div class="node-header">
                    <span class="node-title">${node.name}</span>
                    <span class="node-role-badge">${node.role}</span>
                </div>
                <div class="node-body">
                    <p style="margin-bottom: 6px;"><strong>System:</strong> ${node.system_prompt.slice(0, 48)}...</p>
                </div>
            `;

            // 드래그 이벤트 바인딩
            el.addEventListener('mousedown', (e) => this.onNodeMouseDown(e, node, el));
            this.nodesLayer.appendChild(el);
        });

        this.renderLines();
    }

    onNodeMouseDown(e, node, el) {
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
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
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.connections.forEach(conn => {
            const fromNode = this.nodes.find(n => n.id === conn.from);
            const toNode = this.nodes.find(n => n.id === conn.to);
            if (!fromNode || !toNode) return;

            const startX = fromNode.x + 220; // 노드 오른쪽 끝
            const startY = fromNode.y + 45;  // 노드 세로 중앙
            const endX = toNode.x;           // 대상 노드 왼쪽 시작
            const endY = toNode.y + 45;

            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.moveTo(startX, startY);

            // 부드러운 베지에 곡선
            const cp1X = startX + (endX - startX) / 2;
            const cp1Y = startY;
            const cp2X = startX + (endX - startX) / 2;
            const cp2Y = endY;

            this.ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, endX, endY);
            this.ctx.strokeStyle = '#6366F1';
            this.ctx.lineWidth = 2.5;
            this.ctx.stroke();

            // 화살표 팁
            this.ctx.fillStyle = '#6366F1';
            this.ctx.beginPath();
            this.ctx.arc(endX, endY, 4, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.restore();
        });
    }

    addNode() {
        const count = this.nodes.length + 1;
        const newNode = {
            id: `node_${Date.now()}`,
            name: `🤖 Agent ${count}`,
            role: `보조 역할 ${count}`,
            system_prompt: `당신은 ${count}번째 협업 에이전트입니다.`,
            x: 80 + (count - 1) * 60,
            y: 200 + (count % 2) * 60
        };

        if (this.nodes.length > 0) {
            const lastNode = this.nodes[this.nodes.length - 1];
            this.connections.push({ from: lastNode.id, to: newNode.id });
        }

        this.nodes.push(newNode);
        this.renderNodes();
    }

    getPipelineAgents() {
        return this.nodes.map(n => ({
            name: n.name,
            role: n.role,
            system_prompt: n.system_prompt
        }));
    }
}

window.workflowCanvas = new WorkflowCanvas();
