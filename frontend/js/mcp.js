// MCP (Model Context Protocol) 클라이언트 매니저 (Issue #5)
class MCPClientManager {
    constructor() {
        this.serverListEl = document.getElementById('mcpServerList');
        this.toolListEl = document.getElementById('mcpToolList');
        this.init();
    }

    init() {
        this.loadServers();
        this.loadTools();
    }

    async loadServers() {
        try {
            const res = await fetch('/api/mcp/servers');
            const data = await res.json();
            this.renderServers(data.servers || {});
        } catch (e) {
            console.error('MCP Servers load error:', e);
        }
    }

    async loadTools() {
        try {
            const res = await fetch('/api/mcp/tools');
            const data = await res.json();
            this.renderTools(data.tools || []);
        } catch (e) {
            console.error('MCP Tools load error:', e);
        }
    }

    renderServers(servers) {
        if (!this.serverListEl) return;
        this.serverListEl.innerHTML = '';

        const keys = Object.keys(servers);
        if (keys.length === 0) {
            this.serverListEl.innerHTML = '<div style="color:var(--text-dim); font-size:12px;">등록된 MCP 서버가 없습니다.</div>';
            return;
        }

        keys.forEach(k => {
            const s = servers[k];
            const card = document.createElement('div');
            card.className = 'agent-msg-card';
            card.style.padding = '10px 14px';
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <div style="font-weight:700; font-size:13px; color:var(--text-main);">${s.name || k}</div>
                    <span class="node-role-badge" style="text-transform:uppercase;">${s.type}</span>
                </div>
                <div style="font-size:11px; color:var(--text-muted); font-family:monospace; margin-bottom:6px;">
                    ${s.type === 'stdio' ? s.command : s.url}
                </div>
                <div style="font-size:11px; color:var(--text-dim);">
                    도구: ${(s.tools || []).map(t => `<span style="background:rgba(255,255,255,0.08); padding:2px 5px; border-radius:4px; margin-right:4px;">${t}</span>`).join('')}
                </div>
            `;
            this.serverListEl.appendChild(card);
        });
    }

    renderTools(tools) {
        if (!this.toolListEl) return;
        this.toolListEl.innerHTML = '';

        if (tools.length === 0) {
            this.toolListEl.innerHTML = '<div style="color:var(--text-dim); font-size:12px;">사용 가능한 MCP 도구가 없습니다.</div>';
            return;
        }

        tools.forEach(t => {
            const card = document.createElement('div');
            card.className = 'agent-msg-card';
            card.style.padding = '10px 14px';
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <div style="font-weight:700; font-size:12px; color:var(--accent-cyan); font-family:'JetBrains Mono',monospace;">🛠️ ${t.name}</div>
                    <span class="node-role-badge">${t.server}</span>
                </div>
                <div style="font-size:11px; color:var(--text-muted); margin-bottom:8px;">${t.description}</div>
                <button class="btn-secondary" style="padding:3px 8px; font-size:10px;" onclick="window.mcpManager.testToolPrompt('${t.name}')">⚡ 도구 테스트 호출</button>
            `;
            this.toolListEl.appendChild(card);
        });
    }

    async testToolPrompt(toolName) {
        let args = {};
        if (toolName === 'web_search') {
            const q = prompt("웹 검색 쿼리를 입력하세요:", "LM Studio 로컬 LLM 2026");
            if (!q) return;
            args = { query: q };
        } else if (toolName === 'calc_math') {
            const exp = prompt("계산할 수식을 입력하세요:", "math.sqrt(256) * 4");
            if (!exp) return;
            args = { expression: exp };
        } else {
            args = { input: "test" };
        }

        try {
            const res = await fetch('/api/mcp/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tool: toolName, args: args })
            });
            const data = await res.json();
            alert(`[도구 실행 결과]\n${JSON.stringify(data, null, 2)}`);
        } catch (e) {
            alert(`실행 오류: ${e.message}`);
        }
    }

    async registerNewServer() {
        const id = prompt("새 MCP 서버 ID (영문):", "custom_mcp");
        if (!id) return;
        const name = prompt("서버 표시 이름:", "커스텀 로컬 도구 MCP");
        const type = prompt("연결 타입 (stdio 또는 sse):", "stdio");
        let command = "";
        let url = "";
        if (type === "stdio") {
            command = prompt("실행 커맨드:", "npx -y @modelcontextprotocol/server-sqlite ./db.sqlite");
        } else {
            url = prompt("SSE 엔드포인트 URL:", "http://localhost:8080/sse");
        }

        try {
            const res = await fetch('/api/mcp/servers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: id,
                    name: name,
                    type: type,
                    command: command,
                    url: url,
                    tools: ["query", "execute"]
                })
            });
            const data = await res.json();
            alert("MCP 서버가 성공적으로 등록되었습니다!");
            this.loadServers();
            this.loadTools();
        } catch (e) {
            alert(`등록 실패: ${e.message}`);
        }
    }
}

window.mcpManager = new MCPClientManager();
