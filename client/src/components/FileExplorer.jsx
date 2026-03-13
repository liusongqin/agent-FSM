import React, { useEffect, useState, useCallback } from 'react';
import './FileExplorer.css';

export default function FileExplorer({ cwd }) {
  const [items, setItems] = useState([]);
  const [browsePath, setBrowsePath] = useState('');
  const [error, setError] = useState('');

  const fetchFiles = useCallback(async (dirPath) => {
    try {
      const res = await fetch(`/api/files?path=${encodeURIComponent(dirPath)}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      setItems(data.items || []);
      setBrowsePath(data.path || dirPath);
      setError('');
    } catch (err) {
      setError('无法连接服务器');
    }
  }, []);

  // Sync with terminal cwd
  useEffect(() => {
    if (cwd) {
      fetchFiles(cwd);
    }
  }, [cwd, fetchFiles]);

  const navigateTo = (dirPath) => {
    fetchFiles(dirPath);
  };

  const goUp = () => {
    const parent = browsePath.replace(/\/[^/]+\/?$/, '') || '/';
    fetchFiles(parent);
  };

  return (
    <div className="file-explorer">
      <div className="fe-toolbar">
        <button className="fe-btn" onClick={goUp} title="上级目录">
          ⬆️
        </button>
        <button className="fe-btn" onClick={() => fetchFiles(browsePath)} title="刷新">
          🔄
        </button>
        <span className="fe-path" title={browsePath}>
          {browsePath}
        </span>
      </div>

      {error && <div className="fe-error">{error}</div>}

      <div className="fe-list">
        {items.map((item) => (
          <div
            key={item.path}
            className={`fe-item ${item.isDirectory ? 'fe-dir' : 'fe-file'}`}
            onClick={() => item.isDirectory && navigateTo(item.path)}
          >
            <span className="fe-icon">{item.isDirectory ? '📁' : '📄'}</span>
            <span className="fe-name">{item.name}</span>
          </div>
        ))}
        {items.length === 0 && !error && (
          <div className="fe-empty">空目录</div>
        )}
      </div>
    </div>
  );
}
