const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const cors = require('cors');
const { spawn } = require('node:child_process');
const os = require('os');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// Serve static files from client build in production
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
}

// ─── File System API ───────────────────────────────────────────────
app.get('/api/files', (req, res) => {
  const dirPath = req.query.path || os.homedir();
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const items = entries
      .filter((e) => !e.name.startsWith('.'))
      .map((e) => ({
        name: e.name,
        path: path.join(dirPath, e.name),
        isDirectory: e.isDirectory(),
      }))
      .sort((a, b) => {
        if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
        return a.isDirectory ? -1 : 1;
      });
    res.json({ path: dirPath, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Chat / Model Proxy API ───────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { messages, settings } = req.body;
  const {
    apiBase = 'http://localhost:1234/v1',
    apiKey = 'not-needed',
    model = 'Qwen3.5-0.8B',
    maxTokens = 1024,
    temperature = 0.1,
    topP = 1.0,
    presencePenalty = 2.0,
    topK = 20,
  } = settings || {};

  try {
    const response = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
        top_p: topP,
        presence_penalty: presencePenalty,
        extra_body: { top_k: topK },
      }),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: `Model service error: ${err.message}` });
  }
});

// ─── WebSocket: Terminal (PTY) ────────────────────────────────────
let pty;
try {
  pty = require('node-pty');
} catch {
  console.warn('node-pty not available – terminal will not work');
}

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  if (pathname === '/ws/terminal') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Track current working directory from the PTY
let currentCwd = os.homedir();

wss.on('connection', (ws) => {
  if (!pty) {
    ws.send(JSON.stringify({ type: 'error', data: 'node-pty is not available' }));
    ws.close();
    return;
  }

  const shell = process.env.SHELL || '/bin/bash';
  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: 120,
    rows: 30,
    cwd: currentCwd,
    env: { ...process.env, TERM: 'xterm-256color' },
  });

  // Send cwd on connection
  ws.send(JSON.stringify({ type: 'cwd', data: currentCwd }));

  ptyProcess.onData((data) => {
    try {
      ws.send(JSON.stringify({ type: 'output', data }));
    } catch {
      // ws closed
    }
  });

  ptyProcess.onExit(() => {
    try { ws.close(); } catch { /* ignore */ }
  });

  ws.on('message', (msg) => {
    try {
      const parsed = JSON.parse(msg);
      if (parsed.type === 'input') {
        ptyProcess.write(parsed.data);
      } else if (parsed.type === 'resize') {
        ptyProcess.resize(parsed.cols, parsed.rows);
      } else if (parsed.type === 'getCwd') {
        // Read cwd from /proc on Linux
        try {
          const pid = ptyProcess.pid;
          const cwd = fs.readlinkSync(`/proc/${pid}/cwd`);
          currentCwd = cwd;
          ws.send(JSON.stringify({ type: 'cwd', data: cwd }));
        } catch {
          // fallback – cwd unchanged
          ws.send(JSON.stringify({ type: 'cwd', data: currentCwd }));
        }
      }
    } catch {
      // Raw text input fallback
      ptyProcess.write(msg.toString());
    }
  });

  ws.on('close', () => {
    ptyProcess.kill();
  });
});

// ─── Fallback route for SPA ──────────────────────────────────────
app.get('*', (req, res) => {
  const indexPath = path.join(clientDist, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Not found – run "npm run build" first or use dev mode');
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
