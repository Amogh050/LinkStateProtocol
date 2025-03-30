import React, { useState } from 'react';
import { Network } from '../../models/Network';

interface NetworkControlsProps {
  network: Network;
  onNetworkUpdate: () => void;
}

const NetworkControls: React.FC<NetworkControlsProps> = ({ network, onNetworkUpdate }) => {
  const [nodeId1, setNodeId1] = useState<string>('');
  const [nodeId2, setNodeId2] = useState<string>('');
  const [cost, setCost] = useState<string>('1');

  const handleAddNode = () => {
    // Generate random position within visible area
    const x = Math.random() * 10 - 5;
    const y = Math.random() * 10 - 5;
    const z = Math.random() * 10 - 5;
    
    network.createNode({ x, y, z });
    onNetworkUpdate();
  };

  const handleRemoveNode = () => {
    if (nodeId1 && !isNaN(parseInt(nodeId1))) {
      network.removeNode(parseInt(nodeId1));
      onNetworkUpdate();
      setNodeId1('');
    }
  };

  const handleAddLink = () => {
    if (nodeId1 && nodeId2 && cost &&
      !isNaN(parseInt(nodeId1)) &&
      !isNaN(parseInt(nodeId2)) &&
      !isNaN(parseInt(cost))) {
      network.createLink(parseInt(nodeId1), parseInt(nodeId2), parseInt(cost));
      onNetworkUpdate();
    }
  };

  const handleRemoveLink = () => {
    if (nodeId1 && nodeId2 &&
      !isNaN(parseInt(nodeId1)) &&
      !isNaN(parseInt(nodeId2))) {
      network.removeLink(parseInt(nodeId1), parseInt(nodeId2));
      onNetworkUpdate();
    }
  };

  return (
    <div className="network-controls">
      <h2>Network Controls</h2>
      <div className="control-group">
        <button onClick={handleAddNode}>Add Node</button>
        
        <div className="input-group">
          <input
            type="text"
            placeholder="Node ID"
            value={nodeId1}
            onChange={(e) => setNodeId1(e.target.value)}
          />
          <button onClick={handleRemoveNode}>Remove Node</button>
        </div>
      </div>

      <div className="control-group">
        <h3>Link Operations</h3>
        <div className="input-group">
          <input
            type="text"
            placeholder="Node 1 ID"
            value={nodeId1}
            onChange={(e) => setNodeId1(e.target.value)}
          />
          <input
            type="text"
            placeholder="Node 2 ID"
            value={nodeId2}
            onChange={(e) => setNodeId2(e.target.value)}
          />
          <input
            type="text"
            placeholder="Cost"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
          />
          <button onClick={handleAddLink}>Add Link</button>
        </div>

        <div className="input-group">
          <input
            type="text"
            placeholder="Node 1 ID"
            value={nodeId1}
            onChange={(e) => setNodeId1(e.target.value)}
          />
          <input
            type="text"
            placeholder="Node 2 ID"
            value={nodeId2}
            onChange={(e) => setNodeId2(e.target.value)}
          />
          <button onClick={handleRemoveLink}>Remove Link</button>
        </div>
      </div>
    </div>
  );
};

export default NetworkControls; 