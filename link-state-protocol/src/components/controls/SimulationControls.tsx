import React, { useState, useEffect, useCallback } from 'react';
import { Simulation } from '../../models/Simulation';
import { Network } from '../../models/Network';
import { Packet, LSPData, Link, PacketType } from '../../models/types';
import { Node } from '../../models/Node';
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
  const [routingTablesAvailable, setRoutingTablesAvailable] = useState(false);

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

  // Check routing tables availability whenever network changes
  useEffect(() => {
    const hasRoutingTablesNow = hasRoutingTables();
    setRoutingTablesAvailable(hasRoutingTablesNow);
    console.log(`Routing tables availability updated: ${hasRoutingTablesNow}`);
  }, [network, network.nodes]); // Re-run when network or its nodes change

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
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Send hello packets for the current node
      network.simulateNodeHelloPackets(nodeId);
      simulation.sendHelloPackets(nodeId);
      
      // Wait for the packets to reach their destinations
      const animationTime = 1000; // 3 seconds for packet travel animation
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

    try {
      // Clear all existing routing tables first
      for (const nodeId of nodeIds) {
        const node = network.getNode(nodeId);
        if (node) {
          // Clear routing table
          node.routingTable.clear();
          
          // Also clear topology database to start fresh
          node.topologyDatabase.clear();
          
          // Initialize node's own entry in topology database
          const nodeLinks = new Map<number, number>();
          for (const [linkNodeId, cost] of node.links.entries()) {
            if (network.getNode(linkNodeId)?.active) {
              nodeLinks.set(linkNodeId, cost);
            }
          }
          node.topologyDatabase.set(node.id, nodeLinks);
        }
      }

      // Initial LSP message
      setMessage('Starting LSP flooding process...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Track all processed nodes for final routing table calculation
      const allProcessedNodes = new Set<number>();

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
        
        // Add all processed nodes to the global set
        processedNodes.forEach(node => allProcessedNodes.add(node));
        
        setMessage(`LSP from Node ${nodeId} was flooded to ${processedNodes.size} nodes in the network`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        setCurrentNodeIndex(i + 1);
      }
      
      // Update routing tables for all affected nodes
      setMessage('Calculating final routing tables for all nodes...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify each node has a complete topology database
      let routesCalculated = 0;
      
      // Recalculate routing tables for all active nodes
      for (const nodeId of nodeIds) {
        const node = network.getNode(nodeId);
        if (node) {
          try {
            // Make sure the node has its own topology information
            if (!node.topologyDatabase.has(node.id)) {
              console.log(`Node ${nodeId} missing own topology info, adding it now`);
              const nodeLinks = new Map<number, number>();
              for (const [linkNodeId, cost] of node.links.entries()) {
                if (network.getNode(linkNodeId)?.active) {
                  nodeLinks.set(linkNodeId, cost);
                }
              }
              node.topologyDatabase.set(node.id, nodeLinks);
            }
            
            // Log topology database before calculation
            console.log(`Node ${nodeId} topology database:`, 
              Array.from(node.topologyDatabase.entries())
                .map(([sourceId, links]) => `${sourceId} -> ${Array.from(links.entries()).length} links`)
                .join(', '));
            
            // Calculate routing table
            node.calculateRoutingTable();
            
            // If no routes were calculated but the node has links,
            // ensure at least direct routes to neighbors exist
            if (node.routingTable.size === 0 && node.links.size > 0) {
              console.log(`No routes calculated for Node ${nodeId}, adding direct routes to neighbors as fallback`);
              
              // Add direct routes to neighbors
              for (const [neighborId, cost] of node.links.entries()) {
                const neighbor = network.getNode(neighborId);
                if (neighbor && neighbor.active) {
                  node.routingTable.set(neighborId, {
                    nextHop: neighborId,
                    cost: cost
                  });
                  console.log(`Added direct route from Node ${nodeId} to Node ${neighborId} with cost ${cost}`);
                }
              }
            }
            
            // Log results of calculation
            console.log(`Node ${nodeId} routing table calculated with ${node.routingTable.size} entries:`,
              Array.from(node.routingTable.entries())
                .map(([destId, route]) => `${destId} via ${route.nextHop} cost ${route.cost}`)
                .join(', '));
            
            // Count successful calculations
            routesCalculated += node.routingTable.size;
          } catch (error) {
            console.error(`Error calculating routing table for Node ${nodeId}:`, error);
          }
        }
      }
      
      // Final cleanup
      setMessage(`LSP flooding complete. ${routesCalculated} routes have been calculated across all nodes.`);
      
      // Force a check for routing tables
      const hasTablesNow = hasRoutingTables();
      setRoutingTablesAvailable(hasTablesNow);
      console.log(`After LSP flooding, routing tables available: ${hasTablesNow}`);
      
      // Update UI to show availability
      await new Promise(resolve => setTimeout(resolve, 2000));
      setMessage('');
      
    } finally {
      setIsPerformingLSP(false);
      setCurrentNodeId(null);
      setCurrentNodeIndex(0);
      
      // Force a redraw of the routing tables
      simulation.status.step += 1;
      simulation.onSimulationStep();
    }
  };

  // Helper function to simulate the LSP flooding process with visualizations
  const simulateLSPFlooding = async (sourceNodeId: number, initialPackets: Packet[]) => {
    // Track which nodes have processed each source node's LSP
    // Map of sourceNodeId => Set of nodes that processed its LSP
    const processedLSPs = new Map<number, Set<number>>();
    processedLSPs.set(sourceNodeId, new Set([sourceNodeId]));
    
    // Create a copy of the source node topology for consistent updates
    const sourceNode = network.getNode(sourceNodeId);
    
    // Queue of packets to be processed
    let pendingPackets = [...initialPackets];
    let round = 1;
    
    // Process packets until queue is empty
    while (pendingPackets.length > 0) {
      setMessage(`Round ${round}: Node ${sourceNodeId} flooding ${pendingPackets.length} LSP packets...`);
      
      // Clear any existing packets
      network.packets = [];
      simulation.onSimulationStep();
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Set the new packets and visualize them
      network.packets = pendingPackets;
      simulation.onSimulationStep(); // Trigger simulation update
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Collect new packets to be sent in the next round
      const nextRoundPackets: Packet[] = [];
      
      // Process each packet
      for (const packet of pendingPackets) {
        const targetNodeId = packet.to;
        const sourceLSPNodeId = packet.data.nodeId; // The node that originated this LSP
        
        // Skip processing for inactive nodes
        const targetNode = network.getNode(targetNodeId);
        if (!targetNode || !targetNode.active) continue;
        
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
        
        // Update the target node's topology database - create empty map if not exists
        if (!targetNode.topologyDatabase.has(sourceLSPNodeId)) {
          targetNode.topologyDatabase.set(sourceLSPNodeId, new Map());
        }
        
        const links = packet.data.links;
        const nodeLinks = targetNode.topologyDatabase.get(sourceLSPNodeId)!;
        let updatedInfo = false;
        
        // Update links in the topology database
        for (const link of links) {
          const linkNodeId = link.nodeId;
          const linkCost = link.cost;
          
          // Only process links to active nodes
          if (!network.getNode(linkNodeId)?.active) continue;
          
          // Update if link doesn't exist or cost changed
          if (!nodeLinks.has(linkNodeId) || nodeLinks.get(linkNodeId) !== linkCost) {
            nodeLinks.set(linkNodeId, linkCost);
            updatedInfo = true;
          }
        }
        
        // Debugging - log updates
        if (updatedInfo) {
          console.log(`Node ${targetNodeId} updated topology for Node ${sourceLSPNodeId}, new links:`, 
            Array.from(nodeLinks.entries()).map(([id, cost]) => `${id}:${cost}`).join(', '));
        }
        
        // Only flood to neighbors if this is new information
        if (updatedInfo) {
          // Flood to all neighbors except the one we received from
          const neighborIds = Array.from(targetNode.links.keys())
            .filter(id => network.getNode(id)?.active); // Only consider active nodes
            
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
    if (!routingTablesAvailable) {
      Swal.fire({
        title: 'Error',
        text: 'Please complete LSP flooding first to view network topology.',
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

  // Check if any routing tables exist - more thorough check
  const hasRoutingTables = () => {
    // First check if Hello packets have been run
    if (!hasRunHelloPackets) {
      return false;
    }
    
    // Then check if any node has routing table entries
    let tablesExist = false;
    
    // Check all nodes, not just active ones
    for (const [nodeId, node] of network.nodes.entries()) {
      // Only check active nodes
      if (node.active && node.routingTable.size > 0) {
        console.log(`Found routing table for node ${nodeId} with ${node.routingTable.size} entries`);
        tablesExist = true;
        break;
      }
    }
    
    // Debug info
    if (!tablesExist) {
      console.log('No routing tables found, button will be disabled');
    } else {
      console.log('Routing tables found, button will be enabled');
    }
    
    return tablesExist;
  };

  // Updated path computation based on Dijkstra's algorithm
  const computePath = (sourceId: number, destId: number, sourceNode: Node, network: Network): string => {
    if (sourceId === destId) return `${sourceId}`;
    
    // If the route doesn't exist in the routing table, there's no path
    if (!sourceNode.routingTable.has(destId)) return "No path";
    
    // Reconstruct the path using Dijkstra's algorithm
    const path: number[] = [sourceId];
    let currentNodeId = sourceId;
    let iterations = 0;
    const maxIterations = 20; // Prevent infinite loops
    
    while (currentNodeId !== destId && iterations < maxIterations) {
      const currentNode = network.getNode(currentNodeId);
      if (!currentNode) break;
      
      const nextHop = currentNode.routingTable.get(destId)?.nextHop;
      if (!nextHop) break;
      
      path.push(nextHop);
      currentNodeId = nextHop;
      
      // If we've reached the destination, we're done
      if (currentNodeId === destId) break;
      
      iterations++;
    }
    
    // Format as "A → B → C" exactly like in the image
    return path.join(' → ');
  };

  // Check if two nodes are connected based on topology database
  const areNodesConnected = (sourceNode: Node, destId: number): boolean => {
    // If there's already a route in the routing table, they're connected
    if (sourceNode.routingTable.has(destId)) {
      return true;
    }
    
    // If it's a direct neighbor, they're connected
    if (sourceNode.links.has(destId)) {
      return true;
    }
    
    // More rigorous check using the topology database
    // First, collect all nodes that are in the topology database
    const allKnownNodes = new Set<number>();
    for (const [nodeId, _] of sourceNode.topologyDatabase) {
      allKnownNodes.add(nodeId);
      
      // Add all neighbors of this node
      const links = sourceNode.topologyDatabase.get(nodeId);
      if (links) {
        for (const [neighborId, _] of links) {
          allKnownNodes.add(neighborId);
        }
      }
    }
    
    // If the destination is in the set of all known nodes, it should be reachable
    if (allKnownNodes.has(destId)) {
      return true;
    }
    
    // If we're here, there's no known connection
    return false;
  };

  // Function to calculate direct path and cost between nodes when routing table is incomplete
  const calculateDirectPath = (sourceId: number, destId: number, network: Network): {path: string, cost: number} | null => {
    // BFS to find the shortest path
    const queue: {nodeId: number, path: number[], cost: number}[] = [{
      nodeId: sourceId,
      path: [sourceId],
      cost: 0
    }];
    
    const visited = new Set<number>([sourceId]);
    
    while (queue.length > 0) {
      const { nodeId, path, cost } = queue.shift()!;
      
      // If we've reached the destination, return the path
      if (nodeId === destId) {
        return {
          path: path.join(' → '),
          cost
        };
      }
      
      // Get the current node and its links
      const node = network.getNode(nodeId);
      if (!node || !node.active) continue;
      
      // Check all links from this node
      for (const [neighborId, linkCost] of node.links.entries()) {
        if (visited.has(neighborId)) continue;
        
        const neighbor = network.getNode(neighborId);
        if (!neighbor || !neighbor.active) continue;
        
        visited.add(neighborId);
        queue.push({
          nodeId: neighborId,
          path: [...path, neighborId],
          cost: cost + linkCost
        });
      }
    }
    
    // No path found
    return null;
  };

  // Function to handle showing the routing tables
  const handleShowRoutingTables = () => {
    // Double check if routing tables have been calculated
    if (!hasRoutingTables()) {
      // Determine what's missing
      if (!hasRunHelloPackets) {
        Swal.fire({
          title: 'Error',
          text: 'Please run Hello Packets first to discover neighbors.',
          icon: 'error'
        });
      } else {
        Swal.fire({
          title: 'No Routing Tables',
          text: 'Please complete LSP flooding first to generate routing tables.',
          icon: 'warning'
        });
      }
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

    // Get the active nodes and sort them by ID for consistent display
    const sortedNodeIds = [...activeNodeIds].sort((a, b) => a - b);

    // Create the routing tables HTML
    const tablesHTML = `
      <div class="routing-tables-popup-container">
        ${sortedNodeIds.map(nodeId => {
          const node = network.getNode(nodeId);
          if (!node) return '';
          
          // Get all possible destinations (all active nodes)
          const allDestinations = [...activeNodeIds].sort((a, b) => a - b);
          
          return `
            <div class="routing-table-section">
              <h3>Node ${nodeId} Routing Table</h3>
              <table class="routing-table-display">
                <thead>
                  <tr>
                    <th>Destination</th>
                    <th>Next Hop</th>
                    <th>Total Cost</th>
                    <th>Path</th>
                  </tr>
                </thead>
                <tbody>
                  ${allDestinations.map(destId => {
                    // For self, special case
                    if (destId === nodeId) {
                      return `
                        <tr>
                          <td>${destId}</td>
                          <td>-</td>
                          <td>0</td>
                          <td>${destId}</td>
                        </tr>
                      `;
                    }
                    
                    // Get route if it exists in routing table
                    const route = node.routingTable.get(destId);
                    
                    if (route) {
                      // Use the computed path
                      const path = computePath(node.id, destId, node, network);
                      
                      return `
                        <tr>
                          <td>${destId}</td>
                          <td>${route.nextHop}</td>
                          <td>${route.cost}</td>
                          <td>${path}</td>
                        </tr>
                      `;
                    } else {
                      // If not in routing table, try to calculate directly from graph
                      const directPath = calculateDirectPath(nodeId, destId, network);
                      
                      if (directPath) {
                        // Found a path through direct calculation
                        // Determine next hop from path
                        const pathParts = directPath.path.split(' → ');
                        const nextHop = pathParts.length > 1 ? pathParts[1] : destId;
                        
                        return `
                          <tr>
                            <td>${destId}</td>
                            <td>${nextHop}</td>
                            <td>${directPath.cost}</td>
                            <td>${directPath.path}</td>
                          </tr>
                        `;
                      } else {
                        // No path exists, show infinity
                        return `
                          <tr class="unreachable-route">
                            <td>${destId}</td>
                            <td>-</td>
                            <td>∞</td>
                            <td>No path available</td>
                          </tr>
                        `;
                      }
                    }
                  }).join('')}
                </tbody>
              </table>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Show the popup with the routing tables
    Swal.fire({
      title: 'Routing Tables after LSP Flooding',
      html: tablesHTML,
      width: '80%',
      customClass: {
        container: 'network-topology-popup', // Use the same class as network topology
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
          disabled={!routingTablesAvailable}
        >
          Show Network Topology
        </button>
      </div>

      {/* Toggle button for showing routing tables */}
      <div className="input-group">
        <button 
          className={`toggle-button ${routingTablesAvailable ? 'routing-tables-ready' : ''}`}
          onClick={() => handleShowRoutingTables()}
          disabled={!routingTablesAvailable}
        >
          Show Routing Tables
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