import React, { useState, useEffect, useCallback } from 'react';
import { Simulation } from '../../models/Simulation';
import { Network } from '../../models/Network';

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
  const [showAllTables, setShowAllTables] = useState(false);
  const [allNodeNeighbors, setAllNodeNeighbors] = useState<Map<number, {neighborId: number, cost: number}[]>>(new Map());
  const [hasRunHelloPackets, setHasRunHelloPackets] = useState(false);
  const [activeNodeIds, setActiveNodeIds] = useState<number[]>([]);

  // Function to get active node IDs
  const getActiveNodeIds = useCallback(() => {
    return Array.from(network.nodes.keys())
      .filter(id => network.getNode(id)?.active)
      .sort((a, b) => a - b);
  }, [network]);

  // Clean up deleted nodes from neighbors in all tables
  const cleanupDeletedNodes = useCallback(() => {
    const existingNodeIds = Array.from(network.nodes.keys());
    
    setAllNodeNeighbors(prev => {
      const newMap = new Map(prev);
      
      // Remove tables for deleted nodes
      for (const [nodeId] of newMap) {
        if (!existingNodeIds.includes(nodeId)) {
          newMap.delete(nodeId);
        }
      }
      
      // Clean up references to deleted nodes in neighbor lists
      for (const [nodeId, nodeNeighbors] of newMap) {
        const filteredNeighbors = nodeNeighbors.filter(
          neighbor => existingNodeIds.includes(neighbor.neighborId)
        );
        newMap.set(nodeId, filteredNeighbors);
      }
      
      return newMap;
    });
  }, [network]);

  // Update active node IDs whenever network changes
  useEffect(() => {
    const newActiveNodeIds = getActiveNodeIds();
    setActiveNodeIds(newActiveNodeIds);
    cleanupDeletedNodes();
  }, [network, getActiveNodeIds, cleanupDeletedNodes]);

  // Function to update all node neighbors
  const updateAllNodeNeighbors = useCallback(() => {
    if (!hasRunHelloPackets) {
      setAllNodeNeighbors(new Map());
      return;
    }

    const newAllNodeNeighbors = new Map<number, {neighborId: number, cost: number}[]>();
    const nodeIds = getActiveNodeIds();

    nodeIds.forEach(nodeId => {
      const nodeNeighbors = network.getNodeNeighbors(nodeId);
      newAllNodeNeighbors.set(nodeId, nodeNeighbors);
    });

    setAllNodeNeighbors(newAllNodeNeighbors);
  }, [network, hasRunHelloPackets, getActiveNodeIds]);

  // Update neighbors whenever network changes
  useEffect(() => {
    updateAllNodeNeighbors();
  }, [network, updateAllNodeNeighbors]);

  const handleSendHelloPackets = async () => {
    if (isAnimating) return;

    // Reset the state
    setAllNodeNeighbors(new Map());
    setHasRunHelloPackets(false);

    // Get all active node IDs
    const nodeIds = getActiveNodeIds();

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
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Send hello packets for the current node
      network.simulateNodeHelloPackets(nodeId);
      simulation.sendHelloPackets(nodeId);
      
      // Wait for the packets to reach their destinations
      const animationTime = 3000; // 3 seconds for packet travel animation
      await new Promise(resolve => setTimeout(resolve, animationTime));
      
      // Get and display node's neighbors
      const nodeNeighbors = network.getNodeNeighbors(nodeId);
      
      // Filter out any neighbors that no longer exist in the network
      const filteredNeighbors = nodeNeighbors.filter(
        neighbor => network.getNode(neighbor.neighborId) !== undefined
      );
      
      setNeighbors(filteredNeighbors);
      setShowNeighborTable(true);
      
      // Update the allNodeNeighbors map
      setAllNodeNeighbors(prev => {
        const newMap = new Map(prev);
        newMap.set(nodeId, filteredNeighbors);
        return newMap;
      });
      
      if (filteredNeighbors.length > 0) {
        setMessage(`Node ${nodeId} discovered ${filteredNeighbors.length} neighbor${filteredNeighbors.length > 1 ? 's' : ''} with hello packets`);
      } else {
        setMessage(`Node ${nodeId} has no neighbors`);
      }
      
      // Wait for user to see the neighbor table
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      // Hide the neighbor table before moving to the next node
      setShowNeighborTable(false);
      setCurrentNodeIndex(i + 1);
    }
    
    // Final cleanup
    setMessage('All nodes have completed sending hello packets');
    await new Promise(resolve => setTimeout(resolve, 2000));
    setMessage('');
    setIsAnimating(false);
    setCurrentNodeId(null);
    setCurrentNodeIndex(0);
    setHasRunHelloPackets(true); // Mark that hello packets have been run
    cleanupDeletedNodes(); // Make sure we clean up any deleted nodes
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

      {/* Toggle button for showing all tables */}
      <div className="input-group">
        <button 
          className="toggle-button"
          onClick={() => setShowAllTables(prev => !prev)}
        >
          {showAllTables ? 'Hide Neighbouring Tables' : 'See Neighbouring Tables'}
        </button>
      </div>
      
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

      {/* All nodes' neighbor tables */}
      {showAllTables && (
        <div className="all-tables-container">
          <h3>All Nodes' Neighbor Tables</h3>
          {hasRunHelloPackets ? (
            activeNodeIds.length > 0 ? (
              activeNodeIds.map(nodeId => {
                // Only show nodes that actually exist
                if (!network.getNode(nodeId)) return null;
                
                const nodeNeighbors = allNodeNeighbors.get(nodeId) || [];
                
                // Filter out any deleted neighbors
                const existingNeighbors = nodeNeighbors.filter(
                  neighbor => network.getNode(neighbor.neighborId) !== undefined
                );
                
                return (
                  <div key={nodeId} className="node-table-container">
                    <h4>Node {nodeId}</h4>
                    {existingNeighbors.length > 0 ? (
                      <table className="node-neighbors-table">
                        <thead>
                          <tr>
                            <th>Neighbor ID</th>
                            <th>Link Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {existingNeighbors.map(neighbor => (
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
                );
              }).filter(Boolean) // Filter out nulls
            ) : (
              <p>No active nodes in the network. Add some nodes first.</p>
            )
          ) : (
            <p>Please run the hello packets simulation to discover neighbors.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default SimulationControls;