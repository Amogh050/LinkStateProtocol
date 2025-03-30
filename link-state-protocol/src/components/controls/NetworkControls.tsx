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
  // State for feedback messages
  const [message, setMessage] = useState<string>('');

  // Clear message after 3 seconds
  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleAddNode = () => {
    // Generate random position within visible area
    const x = Math.random() * 10 - 5;
    const y = Math.random() * 10 - 5;
    const z = Math.random() * 10 - 5;
    
    const newNode = network.createNode({ x, y, z });
    showMessage(`Node ${newNode.id} added successfully!`);
    onNetworkUpdate();
  };

  const handleRemoveNode = () => {
    if (nodeId1 && !isNaN(parseInt(nodeId1))) {
      const nodeId = parseInt(nodeId1);
      if (network.nodes.has(nodeId)) {
        network.removeNode(nodeId);
        showMessage(`Node ${nodeId} removed successfully!`);
        onNetworkUpdate();
        setNodeId1('');
      } else {
        showMessage(`Error: Node ${nodeId} does not exist`);
      }
    } else {
      showMessage('Error: Please enter a valid node ID');
    }
  };

  const handleAddLink = () => {
    if (nodeId1 && nodeId2 && cost &&
      !isNaN(parseInt(nodeId1)) &&
      !isNaN(parseInt(nodeId2)) &&
      !isNaN(parseInt(cost))) {
      
      const node1 = parseInt(nodeId1);
      const node2 = parseInt(nodeId2);
      const linkCost = parseInt(cost);
      
      if (!network.nodes.has(node1)) {
        showMessage(`Error: Node ${node1} does not exist`);
        return;
      }
      
      if (!network.nodes.has(node2)) {
        showMessage(`Error: Node ${node2} does not exist`);
        return;
      }
      
      if (node1 === node2) {
        showMessage('Error: Cannot create a link to the same node');
        return;
      }
      
      const success = network.createLink(node1, node2, linkCost);
      if (success) {
        showMessage(`Link between ${node1} and ${node2} added successfully!`);
        onNetworkUpdate();
        setNodeId1('');
        setNodeId2('');
        setCost('1');
      } else {
        showMessage('Error: Could not create link');
      }
    } else {
      showMessage('Error: Please enter valid node IDs and cost');
    }
  };

  const handleRemoveLink = () => {
    if (nodeId1 && nodeId2 &&
      !isNaN(parseInt(nodeId1)) &&
      !isNaN(parseInt(nodeId2))) {
      
      const node1 = parseInt(nodeId1);
      const node2 = parseInt(nodeId2);
      
      if (!network.nodes.has(node1)) {
        showMessage(`Error: Node ${node1} does not exist`);
        return;
      }
      
      if (!network.nodes.has(node2)) {
        showMessage(`Error: Node ${node2} does not exist`);
        return;
      }
      
      const success = network.removeLink(node1, node2);
      if (success) {
        showMessage(`Link between ${node1} and ${node2} removed successfully!`);
        onNetworkUpdate();
        setNodeId1('');
        setNodeId2('');
      } else {
        showMessage('Error: Link does not exist');
      }
    } else {
      showMessage('Error: Please enter valid node IDs');
    }
  };

  return (
    <div className="network-controls">
      <h2>Network Controls</h2>
      
      {message && (
        <div className="message">
          {message}
        </div>
      )}
      
      <div className="control-group">
        <button onClick={handleAddNode} className="primary-button">Add Node</button>
        
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
          <button onClick={handleAddLink} className="primary-button">Add Link</button>
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
      
      <div className="network-status">
        <div>Total Nodes: {network.nodes.size}</div>
        <div>Total Links: {
          Array.from(network.nodes.values()).reduce((count, node) => count + node.links.size, 0) / 2
        }</div>
      </div>
    </div>
  );
};

export default NetworkControls; 