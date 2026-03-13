import React, { useState, useCallback, useRef } from 'react';
import FileExplorer from './components/FileExplorer';
import Terminal from './components/Terminal';
import FSMDesigner from './components/FSMDesigner';
import ChatPanel from './components/ChatPanel';
import SettingsModal from './components/SettingsModal';
import Divider from './components/Divider';
import './App.css';

const DEFAULT_SETTINGS = {
  apiBase: 'http://localhost:1234/v1',
  apiKey: 'not-needed',
  model: 'Qwen3.5-0.8B',
  maxTokens: 1024,
  temperature: 0.1,
  topP: 1.0,
  presencePenalty: 2.0,
  topK: 20,
};

export default function App() {
  // Layout sizes (percentages)
  const [leftWidth, setLeftWidth] = useState(15);
  const [rightWidth, setRightWidth] = useState(25);
  const [bottomHeight, setBottomHeight] = useState(30);

  // State
  const [cwd, setCwd] = useState('');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [chatMode, setChatMode] = useState('ask'); // 'ask' | 'agent'
  const [fsmData, setFsmData] = useState({ nodes: [], edges: [] });
  const [agentState, setAgentState] = useState({
    running: false,
    currentNodeId: null,
    pendingAction: null,
  });
  const [devLog, setDevLog] = useState([]);
  const terminalRef = useRef(null);

  const containerRef = useRef(null);

  // Terminal sends cwd updates
  const handleCwdChange = useCallback((newCwd) => {
    setCwd(newCwd);
  }, []);

  // Send command to terminal
  const sendTerminalCommand = useCallback((cmd) => {
    if (terminalRef.current) {
      terminalRef.current.sendCommand(cmd);
    }
  }, []);

  // Chat sends commands to terminal (agent mode)
  const handleAgentCommand = useCallback(
    (cmd) => {
      sendTerminalCommand(cmd);
    },
    [sendTerminalCommand]
  );

  const centerWidth = 100 - leftWidth - rightWidth;
  const topHeight = 100 - bottomHeight;

  return (
    <div className="app-container" ref={containerRef}>
      {/* Top row */}
      <div className="top-row" style={{ height: `${topHeight}%` }}>
        {/* Left: File Explorer */}
        <div className="panel panel-left" style={{ width: `${leftWidth}%` }}>
          <div className="panel-header">
            <span>📁 文件管理器</span>
          </div>
          <FileExplorer cwd={cwd} />
        </div>

        <Divider
          direction="vertical"
          onDrag={(delta) => {
            const containerW = containerRef.current?.offsetWidth || 1;
            const pct = (delta / containerW) * 100;
            setLeftWidth((p) => Math.max(8, Math.min(40, p + pct)));
          }}
        />

        {/* Center: FSM Designer */}
        <div className="panel panel-center" style={{ width: `${centerWidth}%` }}>
          <div className="panel-header">
            <span>🔀 状态设计器</span>
            {agentState.running && (
              <span className="agent-badge">Agent 运行中</span>
            )}
          </div>
          <FSMDesigner
            fsmData={fsmData}
            setFsmData={setFsmData}
            agentState={agentState}
            setAgentState={setAgentState}
          />
        </div>

        <Divider
          direction="vertical"
          onDrag={(delta) => {
            const containerW = containerRef.current?.offsetWidth || 1;
            const pct = (delta / containerW) * 100;
            setRightWidth((p) => Math.max(15, Math.min(50, p - pct)));
          }}
        />

        {/* Right: Chat Panel */}
        <div className="panel panel-right" style={{ width: `${rightWidth}%` }}>
          <div className="panel-header">
            <span>💬 模型对话</span>
            <div className="header-actions">
              <button
                className={`mode-btn ${chatMode === 'ask' ? 'active' : ''}`}
                onClick={() => setChatMode('ask')}
              >
                Ask
              </button>
              <button
                className={`mode-btn ${chatMode === 'agent' ? 'active' : ''}`}
                onClick={() => setChatMode('agent')}
              >
                Agent
              </button>
              <button
                className="settings-btn"
                onClick={() => setShowSettings(true)}
                title="设置"
              >
                ⚙️
              </button>
            </div>
          </div>
          <ChatPanel
            settings={settings}
            chatMode={chatMode}
            fsmData={fsmData}
            agentState={agentState}
            setAgentState={setAgentState}
            cwd={cwd}
            onAgentCommand={handleAgentCommand}
            devLog={devLog}
            setDevLog={setDevLog}
            sendTerminalCommand={sendTerminalCommand}
          />
        </div>
      </div>

      {/* Horizontal divider */}
      <Divider
        direction="horizontal"
        onDrag={(delta) => {
          const containerH = containerRef.current?.offsetHeight || 1;
          const pct = (delta / containerH) * 100;
          setBottomHeight((p) => Math.max(10, Math.min(60, p - pct)));
        }}
      />

      {/* Bottom: Terminal */}
      <div className="bottom-row" style={{ height: `${bottomHeight}%` }}>
        <div className="panel panel-bottom">
          <div className="panel-header">
            <span>🖥️ 终端</span>
            {cwd && <span className="cwd-display">{cwd}</span>}
          </div>
          <Terminal ref={terminalRef} onCwdChange={handleCwdChange} />
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          setSettings={setSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
