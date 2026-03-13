import React, { useCallback, useMemo, useState, useRef } from 'react';
import {
  ReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MarkerType,
  Handle,
  Position,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './FSMDesigner.css';

/* ── Custom Node ─────────────────────────────────────────────── */
function StateNode({ id, data, selected }) {
  const isActive = data.isAgentCurrent;

  return (
    <div
      className={`fsm-node ${selected ? 'selected' : ''} ${isActive ? 'agent-active' : ''} ${
        data.nodeType === 'start' ? 'node-start' : data.nodeType === 'end' ? 'node-end' : ''
      }`}
    >
      <Handle type="target" position={Position.Top} />
      <div className="node-label">{data.label}</div>
      {data.action && <div className="node-action">{data.action}</div>}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const nodeTypes = { stateNode: StateNode };

let nodeId = 1;

/* ── Inner Flow Component ────────────────────────────────────── */
function FSMFlow({ fsmData, setFsmData, agentState, setAgentState }) {
  const reactFlowInstance = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState(fsmData.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(fsmData.edges);
  const [editingNode, setEditingNode] = useState(null);
  const [editingEdge, setEditingEdge] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const reactFlowWrapper = useRef(null);

  // Sync to parent
  const syncToParent = useCallback(
    (n, e) => {
      setFsmData({ nodes: n || nodes, edges: e || edges });
    },
    [nodes, edges, setFsmData]
  );

  // Highlight agent current node
  const displayNodes = useMemo(() => {
    return nodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        isAgentCurrent: agentState.currentNodeId === n.id,
      },
    }));
  }, [nodes, agentState.currentNodeId]);

  // Connect edges
  const onConnect = useCallback(
    (params) => {
      const newEdge = {
        ...params,
        type: 'default',
        markerEnd: { type: MarkerType.ArrowClosed },
        data: { condition: '' },
        label: '',
      };
      const updated = addEdge(newEdge, edges);
      setEdges(updated);
      syncToParent(nodes, updated);
    },
    [edges, nodes, setEdges, syncToParent]
  );

  // Right-click context menu to add nodes
  const onPaneContextMenu = useCallback(
    (event) => {
      event.preventDefault();
      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });
      setContextMenu({ x: event.clientX, y: event.clientY, flowPos: position });
    },
    [reactFlowInstance]
  );

  const addNode = useCallback(
    (type) => {
      if (!contextMenu) return;
      const id = `state_${nodeId++}`;
      const newNode = {
        id,
        type: 'stateNode',
        position: contextMenu.flowPos,
        data: {
          label: type === 'start' ? '开始' : type === 'end' ? '结束' : `状态${nodeId - 1}`,
          nodeType: type,
          action: '',
        },
      };
      const updated = [...nodes, newNode];
      setNodes(updated);
      syncToParent(updated, edges);
      setContextMenu(null);
    },
    [contextMenu, nodes, edges, setNodes, syncToParent]
  );

  // Double-click node to edit
  const onNodeDoubleClick = useCallback((event, node) => {
    setEditingNode({ ...node });
  }, []);

  // Double-click edge to edit condition
  const onEdgeDoubleClick = useCallback((event, edge) => {
    setEditingEdge({ ...edge });
  }, []);

  const saveNodeEdit = useCallback(() => {
    if (!editingNode) return;
    const updated = nodes.map((n) =>
      n.id === editingNode.id
        ? { ...n, data: { ...n.data, label: editingNode.data.label, action: editingNode.data.action } }
        : n
    );
    setNodes(updated);
    syncToParent(updated, edges);
    setEditingNode(null);
  }, [editingNode, nodes, edges, setNodes, syncToParent]);

  const saveEdgeEdit = useCallback(() => {
    if (!editingEdge) return;
    const updated = edges.map((e) =>
      e.id === editingEdge.id
        ? { ...e, label: editingEdge.label, data: { ...e.data, condition: editingEdge.label } }
        : e
    );
    setEdges(updated);
    syncToParent(nodes, updated);
    setEditingEdge(null);
  }, [editingEdge, nodes, edges, setEdges, syncToParent]);

  // Delete selected nodes/edges with Delete key
  const onKeyDown = useCallback(
    (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selectedNodeIds = new Set(nodes.filter((n) => n.selected).map((n) => n.id));
        const selectedEdgeIds = new Set(edges.filter((e) => e.selected).map((e) => e.id));
        if (selectedNodeIds.size === 0 && selectedEdgeIds.size === 0) return;

        const newNodes = nodes.filter((n) => !selectedNodeIds.has(n.id));
        const newEdges = edges.filter(
          (e) => !selectedEdgeIds.has(e.id) && !selectedNodeIds.has(e.source) && !selectedNodeIds.has(e.target)
        );
        setNodes(newNodes);
        setEdges(newEdges);
        syncToParent(newNodes, newEdges);
      }
    },
    [nodes, edges, setNodes, setEdges, syncToParent]
  );

  return (
    <div className="fsm-designer" ref={reactFlowWrapper} tabIndex={0} onKeyDown={onKeyDown}>
      <ReactFlow
        nodes={displayNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneContextMenu={onPaneContextMenu}
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        nodeTypes={nodeTypes}
        fitView
        deleteKeyCode={null}
        defaultEdgeOptions={{
          markerEnd: { type: MarkerType.ArrowClosed },
        }}
      >
        <Background gap={16} size={1} color="var(--border)" />
        <Controls />
      </ReactFlow>

      {/* Agent confirm bar */}
      {agentState.running && agentState.pendingAction && (
        <div className="agent-confirm-bar">
          <span>Agent 下一步操作：<code>{agentState.pendingAction}</code></span>
          <button
            className="confirm-btn"
            onClick={() => {
              setAgentState((s) => ({ ...s, pendingAction: null }));
            }}
          >
            ✅ 确认执行
          </button>
          <button
            className="cancel-btn"
            onClick={() => {
              setAgentState({ running: false, currentNodeId: null, pendingAction: null });
            }}
          >
            ❌ 停止
          </button>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <>
          <div className="ctx-overlay" onClick={() => setContextMenu(null)} />
          <div
            className="ctx-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <div className="ctx-item" onClick={() => addNode('start')}>
              ➕ 添加开始节点
            </div>
            <div className="ctx-item" onClick={() => addNode('state')}>
              ➕ 添加状态节点
            </div>
            <div className="ctx-item" onClick={() => addNode('end')}>
              ➕ 添加结束节点
            </div>
          </div>
        </>
      )}

      {/* Node edit dialog */}
      {editingNode && (
        <div className="edit-dialog-overlay" onClick={() => setEditingNode(null)}>
          <div className="edit-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>编辑节点</h3>
            <label>
              名称
              <input
                value={editingNode.data.label}
                onChange={(e) =>
                  setEditingNode({
                    ...editingNode,
                    data: { ...editingNode.data, label: e.target.value },
                  })
                }
              />
            </label>
            <label>
              动作 (终端命令)
              <input
                value={editingNode.data.action || ''}
                placeholder="例如: ls -la"
                onChange={(e) =>
                  setEditingNode({
                    ...editingNode,
                    data: { ...editingNode.data, action: e.target.value },
                  })
                }
              />
            </label>
            <div className="edit-buttons">
              <button onClick={saveNodeEdit}>保存</button>
              <button onClick={() => setEditingNode(null)}>取消</button>
            </div>
          </div>
        </div>
      )}

      {/* Edge edit dialog */}
      {editingEdge && (
        <div className="edit-dialog-overlay" onClick={() => setEditingEdge(null)}>
          <div className="edit-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>编辑转换条件</h3>
            <label>
              条件
              <input
                value={editingEdge.label || ''}
                placeholder="例如: 文件存在"
                onChange={(e) =>
                  setEditingEdge({ ...editingEdge, label: e.target.value })
                }
              />
            </label>
            <div className="edit-buttons">
              <button onClick={saveEdgeEdit}>保存</button>
              <button onClick={() => setEditingEdge(null)}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Wrapper with Provider ───────────────────────────────────── */
export default function FSMDesigner(props) {
  return (
    <ReactFlowProvider>
      <FSMFlow {...props} />
    </ReactFlowProvider>
  );
}
