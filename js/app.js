// Main application entry point
document.addEventListener('DOMContentLoaded', () => {
    // Get container elements
    const visualizationContainer = document.getElementById('canvas-container');
    
    // Initialize network
    const network = new Network();
    
    // Initialize visualization
    const visualization = new NetworkVisualization(visualizationContainer, network);
    
    // Initialize simulation
    const simulation = new NetworkSimulation(network, visualization);
    
    // Set up event listeners for UI controls
    setupUIControls(network, visualization, simulation);
    
    // Create initial network topology
    createInitialTopology(network);
    
    // Update routing tables display
    updateRoutingTablesDisplay(network);
});

function setupUIControls(network, visualization, simulation) {
    // Simulation controls
    document.getElementById('start-simulation').addEventListener('click', () => simulation.start());
    document.getElementById('pause-simulation').addEventListener('click', () => simulation.pause());
    document.getElementById('reset-simulation').addEventListener('click', () => simulation.reset());
    
    const speedSlider = document.getElementById('speed-slider');
    speedSlider.addEventListener('input', () => {
        const speed = parseInt(speedSlider.value);
        simulation.setSpeed(speed);
    });
    
    // Network controls
    document.getElementById('add-node').addEventListener('click', () => {
        // Generate random position within visible area
        const x = Math.random() * 10 - 5;
        const y = Math.random() * 10 - 5;
        const z = Math.random() * 10 - 5;
        
        network.createNode({ x, y, z });
        updateRoutingTablesDisplay(network);
    });
    
    document.getElementById('remove-node').addEventListener('click', () => {
        const nodeId = prompt('Enter node ID to remove:');
        if (nodeId && !isNaN(parseInt(nodeId))) {
            network.removeNode(parseInt(nodeId));
            updateRoutingTablesDisplay(network);
        }
    });
    
    document.getElementById('add-link').addEventListener('click', () => {
        const nodeId1 = prompt('Enter first node ID:');
        const nodeId2 = prompt('Enter second node ID:');
        const cost = prompt('Enter link cost:');
        
        if (nodeId1 && nodeId2 && cost && 
            !isNaN(parseInt(nodeId1)) && 
            !isNaN(parseInt(nodeId2)) && 
            !isNaN(parseInt(cost))) {
            network.createLink(parseInt(nodeId1), parseInt(nodeId2), parseInt(cost));
            updateRoutingTablesDisplay(network);
        }
    });
    
    document.getElementById('remove-link').addEventListener('click', () => {
        const nodeId1 = prompt('Enter first node ID:');
        const nodeId2 = prompt('Enter second node ID:');
        
        if (nodeId1 && nodeId2 && 
            !isNaN(parseInt(nodeId1)) && 
            !isNaN(parseInt(nodeId2))) {
            network.removeLink(parseInt(nodeId1), parseInt(nodeId2));
            updateRoutingTablesDisplay(network);
        }
    });
}

function createInitialTopology(network) {
    // Create nodes
    network.createNode({ x: -3, y: 0, z: 0 });
    network.createNode({ x: 0, y: 3, z: 0 });
    network.createNode({ x: 3, y: 0, z: 0 });
    network.createNode({ x: 0, y: -3, z: 0 });
    network.createNode({ x: 0, y: 0, z: 3 });
    
    // Create links
    network.createLink(1, 2, 1);
    network.createLink(2, 3, 1);
    network.createLink(3, 4, 1);
    network.createLink(4, 1, 1);
    network.createLink(5, 1, 2);
    network.createLink(5, 3, 2);
}

function updateRoutingTablesDisplay(network) {
    const container = document.getElementById('routing-table-container');
    container.innerHTML = '';
    
    for (const node of network.nodes.values()) {
        const nodeTable = document.createElement('div');
        nodeTable.className = 'node-routing-table';
        
        const nodeHeader = document.createElement('h4');
        nodeHeader.textContent = `Node ${node.id} Routing Table`;
        nodeTable.appendChild(nodeHeader);
        
        if (node.routingTable.size === 0) {
            const emptyMsg = document.createElement('p');
            emptyMsg.textContent = 'No routes';
            nodeTable.appendChild(emptyMsg);
        } else {
            const table = document.createElement('table');
            table.innerHTML = `
                <tr>
                    <th>Destination</th>
                    <th>Next Hop</th>
                    <th>Cost</th>
                </tr>
            `;
            
            for (const [destId, route] of node.routingTable.entries()) {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${destId}</td>
                    <td>${route.nextHop}</td>
                    <td>${route.cost}</td>
                `;
                table.appendChild(row);
            }
            
            nodeTable.appendChild(table);
        }
        
        container.appendChild(nodeTable);
    }
} 