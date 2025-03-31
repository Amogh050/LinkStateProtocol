import React, { useState, useEffect } from 'react';
import { Network } from '../../models/Network';
import { Node } from '../../models/Node';
import { Route } from '../../models/types';

interface RoutingTablesProps {
  network: Network;
}

const RoutingTables: React.FC<RoutingTablesProps> = ({ network }) => {
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [updatedTables, setUpdatedTables] = useState<boolean>(false);
  const [tableVersion, setTableVersion] = useState<number>(0);
  
  // Get all active nodes
  const activeNodes = Array.from(network.nodes.entries())
    .filter(([_, node]) => node.active)
    .map(([id, node]) => ({ id, node }))
    .sort((a, b) => a.id - b.id);
    
  // Check for routing table updates
  useEffect(() => {
    // Count total number of routing table entries
    let entriesCount = 0;
    
    for (const [_, node] of network.nodes) {
      entriesCount += node.routingTable.size;
    }
    
    // If entries exist, mark tables as updated and increment version
    if (entriesCount > 0) {
      setUpdatedTables(true);
      setTableVersion(prev => prev + 1);
      
      // Reset updated status after animation completes
      const timer = setTimeout(() => {
        setUpdatedTables(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [network]);

  // Function to render the routing table for a single node
  const renderRoutingTable = (nodeId: number, node: Node) => {
    return (
      <div 
        key={`${nodeId}-${tableVersion}`} 
        className={`node-routing-table ${selectedNodeId === nodeId ? 'selected' : ''} ${updatedTables ? 'updated' : ''}`}
        onClick={() => setSelectedNodeId(nodeId === selectedNodeId ? null : nodeId)}
      >
        <h3 className="node-routing-header">
          Node {node.id} Routing Table
          <span className="expand-icon">{selectedNodeId === nodeId ? '−' : '+'}</span>
        </h3>
        
        {(selectedNodeId === nodeId || selectedNodeId === null) && (
          <div className="table-container">
            {node.routingTable.size === 0 ? (
              <p className="no-routes-message">No routes computed. Run LSP flooding to calculate routes.</p>
            ) : (
              <table className="routing-table">
                <thead>
                  <tr>
                    <th>Destination</th>
                    <th>Next Hop</th>
                    <th>Total Cost</th>
                    <th>Path</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(node.routingTable.entries())
                    .sort(([destId1], [destId2]) => Number(destId1) - Number(destId2))
                    .map(([destId, route]) => {
                      // Compute the full path if possible
                      const path = computePath(node.id, Number(destId), node, network);
                      
                      return (
                        <tr key={`${destId}-${tableVersion}`}>
                          <td>Node {destId}</td>
                          <td>Node {route.nextHop}</td>
                          <td>{route.cost}</td>
                          <td>{path}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    );
  };

  // Function to compute the shortest path between nodes
  const computePath = (sourceId: number, destId: number, sourceNode: Node, network: Network): string => {
    if (sourceId === destId) return `${sourceId}`;
    
    const path: number[] = [sourceId];
    let currentNodeId = sourceId;
    let iterations = 0;
    const maxIterations = 10; // Prevent infinite loops
    
    while (currentNodeId !== destId && iterations < maxIterations) {
      const currentNode = network.getNode(currentNodeId);
      if (!currentNode) break;
      
      const nextHop = currentNode.routingTable.get(destId)?.nextHop;
      if (!nextHop) break;
      
      path.push(nextHop);
      currentNodeId = nextHop;
      iterations++;
    }
    
    return path.join(' → ');
  };

  return (
    <div className={`routing-tables-container ${updatedTables ? 'updated' : ''}`}>
      <div className="routing-header">
        <h2 className={updatedTables ? 'updated' : ''}>
          Routing Tables
          {updatedTables && <span className="update-indicator"> (Updated)</span>}
        </h2>
        <p className="routing-info">
          These tables show the computed routes after LSP flooding.<br/>
          Each entry shows the destination node, next hop, total cost, and complete path.
        </p>
      </div>
      
      {activeNodes.length === 0 ? (
        <p className="no-nodes-message">No active nodes in the network</p>
      ) : (
        <div className="tables-grid">
          {activeNodes.map(({ id, node }) => renderRoutingTable(id, node))}
        </div>
      )}
    </div>
  );
};

export default RoutingTables; 