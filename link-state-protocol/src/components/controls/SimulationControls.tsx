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
  const [currentNodeIndex, setCurrentNodeIndex] = useState<number>(0);

  const handleSendHelloPackets = async () => {
    if (isAnimating) return;

    // Get all active node IDs
    const nodeIds = Array.from(network.nodes.keys())
      .filter(id => network.getNode(id)?.active)
      .sort((a, b) => a - b);

    if (nodeIds.length === 0) {
      setMessage('No active nodes in the network');
      return;
    }

    setIsAnimating(true);
    setCurrentNodeIndex(0);

    // Process each node
    for (let i = 0; i < nodeIds.length; i++) {
      const nodeId = nodeIds[i];
      setCurrentNodeId(nodeId);
      setMessage(`Starting hello packet animation for Node ${nodeId}...`);

      // Wait a moment before sending packets
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Send hello packets for the current node
      const packets = network.simulateNodeHelloPackets(nodeId);
      simulation.sendHelloPackets(nodeId);
      
      // Wait for the packets to reach their destinations
      const animationTime = 1000; // 1 second for packet travel animation
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
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Hide the neighbor table before moving to the next node
      setShowNeighborTable(false);
      setCurrentNodeIndex(i + 1);
    }
    
    // Final cleanup
    setMessage('All nodes have completed sending hello packets');
    await new Promise(resolve => setTimeout(resolve, 1000));
    setMessage('');
    setIsAnimating(false);
    setCurrentNodeId(null);
    setCurrentNodeIndex(0);
  };

  return (
    <div className="control-group">
      <h2>Simulation Controls</h2>
      
      {/* Hello packets button */}
      <div className="input-group">
        <button 
          className="hello-button"
          onClick={handleSendHelloPackets}
          disabled={isAnimating}
        >
          {isAnimating ? 'Sending Hello Packets...' : 'Send Hello Packets'}
        </button>
      </div>
      
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