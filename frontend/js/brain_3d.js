// 3D 인터랙티브 뉴런 브레인 지식 그래프 비주얼라이저 (Issue #3)
class Brain3DVisualizer {
    constructor() {
        this.container = document.getElementById('brainContainer');
        this.canvas = document.getElementById('brainCanvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');

        this.nodes = [];
        this.links = [];
        this.rotX = 0.2;
        this.rotY = 0.5;
        this.zoom = 1.3;
        this.isDragging = false;
        this.lastMouse = { x: 0, y: 0 };
        this.hoveredNode = null;
        this.pulseNodes = new Set();

        this.init();
    }

    async init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.bindEvents();
        await this.loadGraphData();
        this.animate();
    }

    resize() {
        if (!this.container || !this.canvas) return;
        this.canvas.width = this.container.clientWidth;
        this.canvas.height = this.container.clientHeight;
    }

    async loadGraphData() {
        try {
            const res = await fetch('/api/brain/graph');
            const data = await res.json();
            this.nodes = data.nodes || [];
            this.links = data.links || [];
            
            const countEl = document.getElementById('brainNodeCount');
            if (countEl) countEl.innerText = `${this.nodes.length}개 지식 뉴런`;
        } catch (e) {
            console.error("Brain graph load error:", e);
        }
    }

    bindEvents() {
        this.canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.lastMouse = { x: e.clientX, y: e.clientY };
        });

        window.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                const dx = e.clientX - this.lastMouse.x;
                const dy = e.clientY - this.lastMouse.y;
                this.rotY += dx * 0.008;
                this.rotX += dy * 0.008;
                this.lastMouse = { x: e.clientX, y: e.clientY };
            } else {
                this.checkHover(e);
            }
        });

        window.addEventListener('mouseup', () => {
            this.isDragging = false;
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.zoom += e.deltaY * -0.0015;
            this.zoom = Math.max(0.6, Math.min(3.0, this.zoom));
        });
    }

    checkHover(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        this.hoveredNode = null;
        for (const n of this.nodes) {
            if (n.projX !== undefined && n.projY !== undefined) {
                const dist = Math.sqrt((mx - n.projX)**2 + (my - n.projY)**2);
                if (dist < (n.size * this.zoom + 5)) {
                    this.hoveredNode = n;
                    break;
                }
            }
        }
    }

    pulseRandomNeuron() {
        if (this.nodes.length === 0) return;
        const randomNode = this.nodes[Math.floor(Math.random() * this.nodes.length)];
        this.pulseNodes.add(randomNode.id);
        setTimeout(() => this.pulseNodes.delete(randomNode.id), 1200);
    }

    project(x, y, z) {
        // 3D 회전 행렬 변환
        // 1. Y축 회전
        const cosY = Math.cos(this.rotY);
        const sinY = Math.sin(this.rotY);
        const x1 = x * cosY - z * sinY;
        const z1 = z * cosY + x * sinY;

        // 2. X축 회전
        const cosX = Math.cos(this.rotX);
        const sinX = Math.sin(this.rotX);
        const y2 = y * cosX - z1 * sinX;
        const z2 = z1 * cosX + y * sinX;

        // 원근 투영 (Perspective Projection)
        const fov = 380;
        const scale = (fov / (fov + z2 + 250)) * this.zoom;
        const projX = this.canvas.width / 2 + x1 * scale;
        const projY = this.canvas.height / 2 + y2 * scale;

        return { projX, projY, scale, z: z2 };
    }

    animate() {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 자율 미세 회전
        if (!this.isDragging) {
            this.rotY += 0.002;
        }

        // 1. 3D 투영 좌표 계산
        const projectedNodes = this.nodes.map(n => {
            const p = this.project(n.x, n.y, n.z);
            n.projX = p.projX;
            n.projY = p.projY;
            n.projScale = p.scale;
            n.projZ = p.z;
            return n;
        });

        // 2. 깊이(Z) 기준 정렬 (뒤에서 앞으로 렌더링)
        projectedNodes.sort((a, b) => b.projZ - a.projZ);

        // 3. 시냅스 링크 렌더링
        this.ctx.lineWidth = 1;
        this.links.forEach(link => {
            const src = this.nodes.find(n => n.id === link.source);
            const tgt = this.nodes.find(n => n.id === link.target);
            if (!src || !tgt) return;

            const isPulsing = this.pulseNodes.has(src.id) || this.pulseNodes.has(tgt.id);

            this.ctx.beginPath();
            this.ctx.moveTo(src.projX, src.projY);
            this.ctx.lineTo(tgt.projX, tgt.projY);

            if (isPulsing) {
                this.ctx.strokeStyle = `rgba(56, 189, 248, 0.8)`;
                this.ctx.lineWidth = 2.5;
            } else {
                this.ctx.strokeStyle = `rgba(99, 102, 241, ${0.15 * link.strength})`;
                this.ctx.lineWidth = 1;
            }
            this.ctx.stroke();
        });

        // 4. 뉴런 노드 렌더링
        projectedNodes.forEach(node => {
            const isHovered = this.hoveredNode && this.hoveredNode.id === node.id;
            const isPulsing = this.pulseNodes.has(node.id);
            const r = Math.max(3, node.size * node.projScale * (isHovered || isPulsing ? 1.5 : 1));

            // 노드 발광 그라디언트
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.arc(node.projX, node.projY, r, 0, Math.PI * 2);
            this.ctx.fillStyle = node.color;
            this.ctx.shadowColor = isHovered || isPulsing ? "#38BDF8" : node.color;
            this.ctx.shadowBlur = isHovered || isPulsing ? 20 : 8;
            this.ctx.fill();

            // 텍스트 라벨 (가까운 노드 및 호버 노드)
            if (node.projZ < 50 || isHovered) {
                this.ctx.fillStyle = isHovered ? "#FFFFFF" : "rgba(248, 250, 252, 0.75)";
                this.ctx.font = `${isHovered ? 'bold 12px' : '10px'} 'Plus Jakarta Sans', sans-serif`;
                this.ctx.shadowBlur = 0;
                this.ctx.fillText(node.title, node.projX + r + 4, node.projY + 3);
            }
            this.ctx.restore();
        });

        // 5. 호버 툴팁 카드 오버레이
        if (this.hoveredNode) {
            this.drawTooltip(this.hoveredNode);
        }

        requestAnimationFrame(() => this.animate());
    }

    drawTooltip(node) {
        const x = node.projX + 15;
        const y = node.projY - 15;
        const pad = 12;

        this.ctx.save();
        this.ctx.fillStyle = "rgba(15, 20, 32, 0.92)";
        this.ctx.strokeStyle = "rgba(99, 102, 241, 0.6)";
        this.ctx.lineWidth = 1.5;
        this.ctx.shadowColor = "rgba(0,0,0,0.6)";
        this.ctx.shadowBlur = 12;

        const w = 240;
        const h = 75;
        this.ctx.roundRect(x, y, w, h, 8);
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = "#38BDF8";
        this.ctx.font = "bold 12px 'Plus Jakarta Sans'";
        this.ctx.fillText(`🧠 ${node.title}`, x + pad, y + 20);

        this.ctx.fillStyle = "#94A3B8";
        this.ctx.font = "11px 'Plus Jakarta Sans'";
        this.ctx.fillText(`카테고리: ${node.category} (중요도: ${node.importance})`, x + pad, y + 38);

        this.ctx.fillStyle = "#E2E8F0";
        this.ctx.fillText(node.content.slice(0, 26) + "...", x + pad, y + 56);
        this.ctx.restore();
    }
}

window.brainVisualizer = new Brain3DVisualizer();
