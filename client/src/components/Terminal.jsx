import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import './Terminal.css';

const TerminalComponent = forwardRef(function TerminalComponent({ onCwdChange }, ref) {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const fitRef = useRef(null);
  const wsRef = useRef(null);
  const cwdPollRef = useRef(null);

  // Expose sendCommand to parent
  useImperativeHandle(ref, () => ({
    sendCommand(cmd) {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data: cmd + '\n' }));
      }
    },
  }));

  const connectWs = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws/terminal`);
    wsRef.current = ws;

    ws.onopen = () => {
      // Start polling cwd
      cwdPollRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'getCwd' }));
        }
      }, 2000);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'output' && termRef.current) {
          termRef.current.write(msg.data);
        } else if (msg.type === 'cwd') {
          onCwdChange?.(msg.data);
        }
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      clearInterval(cwdPollRef.current);
    };

    return ws;
  }, [onCwdChange]);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      theme: {
        background: '#1e1e2e',
        foreground: '#cdd6f4',
        cursor: '#f5e0dc',
        selectionBackground: '#45475a',
      },
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
      cursorBlink: true,
      scrollback: 5000,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();
    termRef.current = term;
    fitRef.current = fitAddon;

    const ws = connectWs();

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    });

    const ro = new ResizeObserver(() => {
      try { fitAddon.fit(); } catch { /* ignore */ }
    });
    ro.observe(containerRef.current);

    return () => {
      clearInterval(cwdPollRef.current);
      ro.disconnect();
      ws.close();
      term.dispose();
    };
  }, [connectWs]);

  return <div className="terminal-container" ref={containerRef} />;
});

export default TerminalComponent;
