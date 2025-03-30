import React, { useState } from 'react';
import { Simulation } from '../../models/Simulation';
import { Network } from '../../models/Network';
import { Node } from '../../models/Node';

interface SimulationControlsProps {
  simulation: Simulation;
  network: Network;
}

const SimulationControls: React.FC<SimulationControlsProps> = ({ simulation, network }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [message, setMessage] = useState('');
  const [currentNodeId, setCurrentNodeId] = useState<number | null>(null);
  const [neighbors, setNeighbors] = useState<{neighborId: number, cost: number}[]>([]);
  const [showNeighborTable, setShowNeighborTable] = useState(false);

  const handleSendHelloPackets = async () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setMessage('Starting hello packet animation...');

    // Get all node IDs
    const nodeIds = Array.from(network.nodes.keys()).sort((a, b) => a - b);
    
    // Process each node one by one
    for (let i = 0; i < nodeIds.length; i++) {
      const nodeId = nodeIds[i];
      const node = network.getNode(nodeId);
      
      if (!node || !node.active) continue;
      
      // Set current node and highlight it
      setCurrentNodeId(nodeId);
      setMessage(`Node ${nodeId} is sending hello packets to its neighbors...`);
      
      // Wait a moment before sending packets
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Send hello packets for this node
      const packets = network.simulateNodeHelloPackets(nodeId);
      
      // Wait for the packets to reach their destinations
      // This needs to be long enough for the animation to complete
      const animationTime = 3000; // 3 seconds for packet travel animation
      await new Promise(resolve => setTimeout(resolve, animationTime));
      
      // Get and display node's neighbors
      const nodeNeighbors = network.getNodeNeighbors(nodeId);
      setNeighbors(nodeNeighbors);
      setShowNeighborTable(true);
      
      if (nodeNeighbors.length > 0) {
        setMessage(`Node ${nodeId} discovered ${nodeNeighbors.length} neighbor${nodeNeighbors.length > 1 ? 's' : ''} with hello packets`);
      } else {
        setMessage(`Node ${nodeId} has no neighbors`);
      }
      
      // Wait for user to see the neighbor table
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      // Hide the neighbor table before moving to the next node
      setShowNeighborTable(false);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Final update after all nodes have sent hello packets
    setMessage('All nodes have sent hello packets. Now updating routing tables...');
    setCurrentNodeId(null);
    
    // Give time for the final message to be read
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Update all routing tables in the network
    for (const node of network.nodes.values()) {
      if (node.active) {
        node.calculateRoutingTable();
      }
    }
    
    setMessage('All routing tables have been successfully updated!');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    setMessage('');
    setIsAnimating(false);
  };

  return (
    <div className="control-group">
      <h2>Simulation Controls</h2>
      
      {/* Hello packets button */}
      <button 
        className="hello-button"
        onClick={handleSendHelloPackets}
        disabled={isAnimating}
      >
        {isAnimating ? 'Sending Hello Packets...' : 'Send Hello Packets'}
      </button>
      
      {/* Animation progress */}
      {isAnimating && (
        <div className="animation-progress">
          <div className="progress-bar">
            <div className="progress-fill"></div>
          </div>
        </div>
      )}
      
      {/* Animation message */}
      {message && (
        <div className="animation-message">
          {message}
        </div>
      )}
      
      {/* Current node indicator */}
      {currentNodeId !== null && (
        <div className="current-node">
          <div className="node-indicator">
            <span className="node-dot"></span>
            <span>Current Node: {currentNodeId}</span>
          </div>
          
          {/* Node neighbors table */}
          {showNeighborTable && (
            <div className="node-neighbors-table-container">
              <h3>Discovered Neighbors</h3>
              {neighbors.length > 0 ? (
                <table className="node-neighbors-table">
                  <thead>
                    <tr>
                      <th>Neighbor ID</th>
                      <th>Link Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {neighbors.map(neighbor => (
                      <tr key={neighbor.neighborId}>
                        <td>Node {neighbor.neighborId}</td>
                        <td>{neighbor.cost}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>No neighbors discovered</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SimulationControls; 