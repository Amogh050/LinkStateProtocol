import React, { useState, useEffect, useCallback } from 'react';
import { Simulation } from '../../models/Simulation';
import { Network } from '../../models/Network';
import { Packet, LSPData, Link, PacketType } from '../../models/types';
import Swal from 'sweetalert2';

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
  const [showNetworkTopology, setShowNetworkTopology] = useState(false);
  const [allNodeNeighbors, setAllNodeNeighbors] = useState<Map<number, {neighborId: number, cost: number}[]>>(new Map());
  const [hasRunHelloPackets, setHasRunHelloPackets] = useState(false);
  const [activeNodeIds, setActiveNodeIds] = useState<number[]>([]);
  const [isPerformingLSP, setIsPerformingLSP] = useState(false);

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

  const handlePerformLSPFlooding = async () => {
    if (isAnimating || isPerformingLSP) return;
    
    // Check if hello packets have been run
    if (!hasRunHelloPackets) {
      setMessage('Please run Hello Packets first to discover neighbors');
      await new Promise(resolve => setTimeout(resolve, 2000));
      setMessage('');
      return;
    }

    // Clear any existing packets
    network.packets = [];
    simulation.onSimulationStep();

    // Get all active node IDs
    const nodeIds = getActiveNodeIds();

    if (nodeIds.length === 0) {
      setMessage('No active nodes in the network');
      return;
    }

    setIsPerformingLSP(true);
    setCurrentNodeIndex(0);

    // Initial LSP message
    setMessage('Starting LSP flooding process...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Process each node as an originator of LSPs
    for (let i = 0; i < nodeIds.length; i++) {
      const nodeId = nodeIds[i];
      setCurrentNodeId(nodeId);
      
      // Get the node's neighbors
      const nodeNeighbors = network.getNodeNeighbors(nodeId);
      
      // If no neighbors, skip this node
      if (nodeNeighbors.length === 0) {
        setMessage(`Node ${nodeId} has no neighbors to send LSPs to`);
        await new Promise(resolve => setTimeout(resolve, 1500));
        continue;
      }
      
      // Generate LSP data once for this node
      const lspData: LSPData = {
        nodeId: nodeId,
        links: nodeNeighbors.map(neighbor => ({ 
          nodeId: neighbor.neighborId, 
          cost: neighbor.cost 
        }))
      };
      
      // Create initial packets for the first round of flooding
      const initialPackets: Packet[] = [];
      for (const neighbor of nodeNeighbors) {
        initialPackets.push({
          type: 'LSP' as PacketType,
          from: nodeId,
          to: neighbor.neighborId,
          data: lspData
        });
      }
      
      // Start directly with flooding simulation
      setMessage(`Starting LSP flooding from Node ${nodeId}...`);
      
      // Simulate the flooding with the initial packets
      const processedNodes = await simulateLSPFlooding(nodeId, initialPackets);
      
      setMessage(`LSP from Node ${nodeId} was flooded to ${processedNodes.size} nodes in the network`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update routing tables for all affected nodes
      for (const affectedNodeId of processedNodes) {
        const node = network.getNode(affectedNodeId);
        if (node) {
          node.calculateRoutingTable();
        }
      }
      
      setCurrentNodeIndex(i + 1);
    }
    
    // Final cleanup
    setMessage('LSP flooding complete. All routing tables have been updated.');
    await new Promise(resolve => setTimeout(resolve, 2000));
    setMessage('');
    setIsPerformingLSP(false);
    setCurrentNodeId(null);
    setCurrentNodeIndex(0);
    
    // Force a redraw of the routing tables
    simulation.status.step += 1;
    simulation.onSimulationStep();
  };

  // Helper function to simulate the LSP flooding process with visualizations
  const simulateLSPFlooding = async (sourceNodeId: number, initialPackets: Packet[]) => {
    // Track which nodes have processed each source node's LSP
    // Map of sourceNodeId => Set of nodes that processed its LSP
    const processedLSPs = new Map<number, Set<number>>();
    processedLSPs.set(sourceNodeId, new Set([sourceNodeId]));
    
    // Queue of packets to be processed
    let pendingPackets = [...initialPackets];
    let round = 1;
    
    // Process packets until queue is empty
    while (pendingPackets.length > 0) {
      setMessage(`Round ${round}: Node ${sourceNodeId} flooding ${pendingPackets.length} LSP packets...`);
      
      // Clear any existing packets
      network.packets = [];
      simulation.onSimulationStep();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Set the new packets and visualize them
      network.packets = pendingPackets;
      simulation.onSimulationStep(); // Trigger simulation update
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Collect new packets to be sent in the next round
      const nextRoundPackets: Packet[] = [];
      
      // Process each packet
      for (const packet of pendingPackets) {
        const targetNodeId = packet.to;
        const sourceLSPNodeId = packet.data.nodeId; // The node that originated this LSP
        
        // Ensure we have a set for this source node
        if (!processedLSPs.has(sourceLSPNodeId)) {
          processedLSPs.set(sourceLSPNodeId, new Set());
        }
        
        const processedNodesForSource = processedLSPs.get(sourceLSPNodeId)!;
        
        // Skip if this target node already processed this source's LSP
        if (processedNodesForSource.has(targetNodeId)) {
          continue;
        }
        
        // Mark this node as having processed this source's LSP
        processedNodesForSource.add(targetNodeId);
        
        // Get the target node's neighbors
        const targetNode = network.getNode(targetNodeId);
        if (!targetNode || !targetNode.active) continue;
        
        // Update the target node's topology database
        if (!targetNode.topologyDatabase.has(sourceLSPNodeId)) {
          targetNode.topologyDatabase.set(sourceLSPNodeId, new Map());
        }
        
        const links = packet.data.links;
        const nodeLinks = targetNode.topologyDatabase.get(sourceLSPNodeId)!;
        let updatedInfo = false;
        
        // Update links in the topology database
        for (const link of links) {
          if (!nodeLinks.has(link.nodeId) || nodeLinks.get(link.nodeId) !== link.cost) {
            nodeLinks.set(link.nodeId, link.cost);
            updatedInfo = true;
          }
        }
        
        // Only flood to neighbors if this is new information
        if (updatedInfo) {
          // Flood to all neighbors except the one we received from
          const neighborIds = Array.from(targetNode.links.keys());
          for (const neighborId of neighborIds) {
            // Skip the sender to avoid loops
            if (neighborId === packet.from) continue;
            
            // Skip if this neighbor already processed this source's LSP
            if (processedNodesForSource.has(neighborId)) continue;
            
            // Create a new packet to forward
            nextRoundPackets.push({
              type: 'LSP' as PacketType,
              from: targetNodeId,
              to: neighborId,
              data: packet.data // Forward the same LSP data
            });
          }
        }
      }
      
      // Move to next round
      pendingPackets = nextRoundPackets;
      round++;
      
      // Safety check to prevent infinite loops
      if (round > 15 || nextRoundPackets.length === 0) {
        if (round > 15) {
          setMessage('LSP flooding terminated - maximum rounds reached');
        }
        break;
      }
    }
    
    // Return all nodes that processed LSPs from the source node
    return processedLSPs.get(sourceNodeId) || new Set();
  };

  const handleShowNetworkTopology = () => {
    if (!hasRunHelloPackets) {
      Swal.fire({
        title: 'Error',
        text: 'Please run the LSP flooding simulation first.',
        icon: 'error'
      });
      return;
    }

    if (activeNodeIds.length === 0) {
      Swal.fire({
        title: 'Error',
        text: 'No active nodes in the network. Add some nodes first.',
        icon: 'error'
      });
      return;
    }

    // Create the table HTML
    const tableHTML = `
      <div class="network-topology-container">
        <table class="network-topology-table">
          <thead>
            <tr>
              <th>LSP Originator</th>
              <th>Neighbors & Metrics</th>
            </tr>
          </thead>
          <tbody>
            ${activeNodeIds.map(nodeId => {
              const node = network.getNode(nodeId);
              if (!node) return '';

              // Get all neighbors from topology database
              const nodeTopology = node.topologyDatabase.get(nodeId);
              if (!nodeTopology) return '';

              const neighborsList = Array.from(nodeTopology.entries())
                .map(([neighborId, cost]) => `Node ${neighborId} (cost ${cost})`)
                .join(', ');

              // Get sequence number (you may need to add this to your Node class)
              const sequenceNumber = node.lsp.sequenceNumber || '-';
              
              return `
                <tr>
                  <td>Node ${nodeId}</td>
                  <td>${neighborsList || 'No neighbors'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    // Show the popup with the table
    Swal.fire({
      title: 'Network Topology after LSP Flooding',
      html: tableHTML,
      width: '80%',
      customClass: {
        container: 'network-topology-popup',
        popup: 'network-topology-popup-content',
        htmlContainer: 'network-topology-popup-html'
      }
    });
  };

  return (
    <div className="control-group">
      <h2>Simulation Controls</h2>
      
      {/* Hello packets button */}
      <div className="input-group">
        <button 
          className="hello-button"
          onClick={handleSendHelloPackets}
          disabled={isAnimating || isPerformingLSP}
        >
          {isAnimating ? 'Sending Hello Packets...' : 'Send Hello Packets'}
        </button>
      </div>

      {/* LSP flooding button */}
      <div className="input-group">
        <button 
          className="lsp-button"
          onClick={handlePerformLSPFlooding}
          disabled={isAnimating || isPerformingLSP}
        >
          {isPerformingLSP ? 'LSP Flooding in Progress...' : 'Start LSP Flooding'}
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

      {/* Toggle button for showing network topology */}
      <div className="input-group">
        <button 
          className="toggle-button"
          onClick={() => handleShowNetworkTopology()}
          disabled={!hasRunHelloPackets}
        >
          Show Network Topology
        </button>
      </div>
      
      {/* Animation progress */}
      {(isAnimating || isPerformingLSP) && (
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