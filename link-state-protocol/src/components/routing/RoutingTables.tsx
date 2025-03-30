import React from 'react';
import { Network } from '../../models/Network';
import { Node } from '../../models/Node';
import { Route } from '../../models/types';

interface RoutingTablesProps {
  network: Network;
}

const RoutingTables: React.FC<RoutingTablesProps> = ({ network }) => {
  return (
    <div className="routing-tables">
      <h2>Routing Tables</h2>
      {Array.from(network.nodes.entries()).map(([id, node]) => (
        <div key={id} className="node-routing-table">
          <h3>Node {node.id}</h3>
          {node.routingTable.size === 0 ? (
            <p>No routes</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Destination</th>
                  <th>Next Hop</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(node.routingTable.entries()).map(([destId, route]) => (
                  <tr key={destId}>
                    <td>{destId}</td>
                    <td>{route.nextHop}</td>
                    <td>{route.cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
};

export default RoutingTables; 