import React, { useState, useRef, useEffect, useCallback } from 'react';
import './ChatPanel.css';

export default function ChatPanel({
  settings,
  chatMode,
  fsmData,
  agentState,
  setAgentState,
  cwd,
  onAgentCommand,
  devLog,
  setDevLog,
  sendTerminalCommand,
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Build system prompt based on mode
  const buildSystemPrompt = useCallback(() => {
    if (chatMode === 'ask') {
      return `你是一个智能助手，当前用户的工作目录是: ${cwd || '未知'}。请用中文回答用户的问题。`;
    }

    // Agent mode – supply FSM context
    const currentNode = fsmData.nodes.find((n) => n.id === agentState.currentNodeId);
    const outEdges = fsmData.edges.filter((e) => e.source === agentState.currentNodeId);
    const nextNodes = outEdges.map((e) => {
      const target = fsmData.nodes.find((n) => n.id === e.target);
      return { condition: e.label || e.data?.condition || '无条件', targetLabel: target?.data?.label, targetAction: target?.data?.action };
    });

    return [
      `你是一个有限状态机Agent。`,
      `全局环境: 当前路径=${cwd || '未知'}, 任务目标=按照状态机执行`,
      `当前状态: ${currentNode ? currentNode.data.label : '无'}`,
      `当前动作: ${currentNode?.data?.action || '无'}`,
      `可选的下一步路径:`,
      ...nextNodes.map((n, i) => `  ${i + 1}. 条件="${n.condition}" -> 目标="${n.targetLabel}" (动作: ${n.targetAction || '无'})`),
      ``,
      `请根据当前状态和环境，决定下一步操作。如果当前状态有动作(终端命令)，请输出该命令。`,
      `回复格式: 先说明判断理由，然后在最后一行用 COMMAND: <命令> 的格式给出要执行的终端命令，或用 TRANSITION: <目标状态名称> 表示需要转移到哪个状态。`,
    ].join('\n');
  }, [chatMode, cwd, fsmData, agentState]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', content: text };
    const systemMsg = { role: 'system', content: buildSystemPrompt() };
    const allMessages = [systemMsg, ...messages, userMsg];

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Log to dev panel
    const logEntry = {
      timestamp: new Date().toLocaleTimeString(),
      request: { messages: allMessages, settings },
    };

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: allMessages, settings }),
      });
      const data = await res.json();

      if (data.error) {
        const errMsg = { role: 'assistant', content: `⚠️ 错误: ${data.error}` };
        setMessages((prev) => [...prev, errMsg]);
        logEntry.response = data;
        logEntry.error = true;
      } else {
        const reply = data.choices?.[0]?.message?.content || '(无回复)';
        const assistantMsg = { role: 'assistant', content: reply };
        setMessages((prev) => [...prev, assistantMsg]);
        logEntry.response = data;

        // Agent mode: parse command and request confirmation
        if (chatMode === 'agent') {
          const cmdMatch = reply.match(/COMMAND:\s*(.+)/);
          const transMatch = reply.match(/TRANSITION:\s*(.+)/);

          if (cmdMatch) {
            setAgentState((s) => ({
              ...s,
              running: true,
              pendingAction: cmdMatch[1].trim(),
            }));
          }
          if (transMatch) {
            const targetLabel = transMatch[1].trim();
            const targetNode = fsmData.nodes.find(
              (n) => n.data.label === targetLabel
            );
            if (targetNode) {
              setAgentState((s) => ({
                ...s,
                currentNodeId: targetNode.id,
                pendingAction: targetNode.data.action || null,
              }));
            }
          }
        }
      }
    } catch (err) {
      const errMsg = { role: 'assistant', content: `⚠️ 网络错误: ${err.message}` };
      setMessages((prev) => [...prev, errMsg]);
      logEntry.error = true;
      logEntry.response = { error: err.message };
    }

    setDevLog((prev) => [...prev, logEntry]);
    setLoading(false);
  }, [input, loading, messages, settings, buildSystemPrompt, chatMode, fsmData, setAgentState, setDevLog]);

  // Start agent from first start node
  const startAgent = useCallback(() => {
    const startNode = fsmData.nodes.find((n) => n.data.nodeType === 'start');
    if (!startNode) {
      alert('请先在状态设计器中添加一个开始节点');
      return;
    }
    setAgentState({
      running: true,
      currentNodeId: startNode.id,
      pendingAction: startNode.data.action || null,
    });
    setMessages([{ role: 'system', content: 'Agent 已启动，从开始节点开始执行。' }]);
  }, [fsmData.nodes, setAgentState]);

  // Confirm agent action
  useEffect(() => {
    if (agentState.running && agentState.pendingAction === null && agentState.currentNodeId) {
      // No pending action – check if there's an action on current node
      const currentNode = fsmData.nodes.find((n) => n.id === agentState.currentNodeId);
      if (currentNode?.data?.action) {
        setAgentState((s) => ({ ...s, pendingAction: currentNode.data.action }));
      }
    }
  }, [agentState, fsmData.nodes, setAgentState]);

  // When user confirms, execute the command
  const originalPendingAction = useRef(null);
  useEffect(() => {
    if (agentState.running && agentState.pendingAction) {
      originalPendingAction.current = agentState.pendingAction;
    }
    if (
      agentState.running &&
      !agentState.pendingAction &&
      originalPendingAction.current
    ) {
      // User confirmed – execute
      sendTerminalCommand(originalPendingAction.current);
      originalPendingAction.current = null;
    }
  }, [agentState.pendingAction, agentState.running, sendTerminalCommand]);

  return (
    <div className="chat-panel">
      {/* Agent controls */}
      {chatMode === 'agent' && (
        <div className="agent-controls">
          {!agentState.running ? (
            <button className="agent-start-btn" onClick={startAgent}>
              ▶️ 启动 Agent
            </button>
          ) : (
            <button
              className="agent-stop-btn"
              onClick={() =>
                setAgentState({ running: false, currentNodeId: null, pendingAction: null })
              }
            >
              ⏹️ 停止 Agent
            </button>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-msg chat-${msg.role}`}>
            <div className="msg-role">
              {msg.role === 'user' ? '👤' : msg.role === 'assistant' ? '🤖' : 'ℹ️'}
            </div>
            <div className="msg-content">
              <pre>{msg.content}</pre>
            </div>
          </div>
        ))}
        {loading && (
          <div className="chat-msg chat-assistant">
            <div className="msg-role">🤖</div>
            <div className="msg-content typing">思考中...</div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-bar">
        <textarea
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder={chatMode === 'ask' ? '输入问题...' : '输入指令给Agent...'}
          rows={1}
        />
        <button className="send-btn" onClick={sendMessage} disabled={loading}>
          发送
        </button>
      </div>

      {/* Dev Monitor Toggle */}
      <div className="dev-toggle">
        <button onClick={() => setShowDevPanel(!showDevPanel)}>
          {showDevPanel ? '隐藏' : '显示'}开发者监测
        </button>
      </div>

      {/* Dev Monitor Panel */}
      {showDevPanel && (
        <div className="dev-panel">
          <div className="dev-panel-header">
            <span>🔍 开发者监测 - 发送给模型的内容</span>
            <button onClick={() => setDevLog([])}>清除</button>
          </div>
          <div className="dev-panel-content">
            {devLog.length === 0 && (
              <div className="dev-empty">暂无请求记录</div>
            )}
            {devLog.map((entry, i) => (
              <div key={i} className={`dev-entry ${entry.error ? 'dev-error' : ''}`}>
                <div className="dev-time">{entry.timestamp}</div>
                <details>
                  <summary>请求内容</summary>
                  <pre>{JSON.stringify(entry.request, null, 2)}</pre>
                </details>
                <details>
                  <summary>响应内容</summary>
                  <pre>{JSON.stringify(entry.response, null, 2)}</pre>
                </details>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
