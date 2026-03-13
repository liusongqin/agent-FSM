import React from 'react';
import './SettingsModal.css';

export default function SettingsModal({ settings, setSettings, onClose }) {
  const update = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <h2>⚙️ 模型设置</h2>

        <div className="settings-form">
          <label>
            API Base URL
            <input
              type="text"
              value={settings.apiBase}
              onChange={(e) => update('apiBase', e.target.value)}
            />
          </label>

          <label>
            API Key
            <input
              type="password"
              value={settings.apiKey}
              onChange={(e) => update('apiKey', e.target.value)}
            />
          </label>

          <label>
            Model
            <input
              type="text"
              value={settings.model}
              onChange={(e) => update('model', e.target.value)}
            />
          </label>

          <div className="settings-row">
            <label>
              Max Tokens
              <input
                type="number"
                value={settings.maxTokens}
                onChange={(e) => update('maxTokens', parseInt(e.target.value) || 0)}
              />
            </label>

            <label>
              Temperature
              <input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={settings.temperature}
                onChange={(e) => update('temperature', parseFloat(e.target.value) || 0)}
              />
            </label>
          </div>

          <div className="settings-row">
            <label>
              Top P
              <input
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={settings.topP}
                onChange={(e) => update('topP', parseFloat(e.target.value) || 0)}
              />
            </label>

            <label>
              Presence Penalty
              <input
                type="number"
                step="0.1"
                min="-2"
                max="2"
                value={settings.presencePenalty}
                onChange={(e) => update('presencePenalty', parseFloat(e.target.value) || 0)}
              />
            </label>
          </div>

          <label>
            Top K
            <input
              type="number"
              min="1"
              value={settings.topK}
              onChange={(e) => update('topK', parseInt(e.target.value) || 1)}
            />
          </label>
        </div>

        <div className="settings-actions">
          <button className="settings-save" onClick={onClose}>
            保存并关闭
          </button>
        </div>
      </div>
    </div>
  );
}
