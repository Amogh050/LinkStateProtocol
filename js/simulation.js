class NetworkSimulation {
    constructor(network, visualization) {
        this.network = network;
        this.visualization = visualization;
        this.running = false;
        this.speed = 5; // Default speed (1-10)
        this.simulationStep = 0;
        this.simulationInterval = null;
    }
    
    start() {
        if (!this.running) {
            this.running = true;
            const intervalTime = 2000 / this.speed; // Adjust timing based on speed
            
            this.simulationInterval = setInterval(() => {
                this.step();
            }, intervalTime);
        }
    }
    
    pause() {
        if (this.running) {
            this.running = false;
            clearInterval(this.simulationInterval);
        }
    }
    
    reset() {
        this.pause();
        this.simulationStep = 0;
        
        // Clear all packets
        for (const packetId of this.visualization.packetObjects.keys()) {
            const packetObject = this.visualization.packetObjects.get(packetId);
            this.visualization.scene.remove(packetObject);
        }
        this.visualization.packetObjects.clear();

        // Clear network state
        this.network.nodes.clear();
        this.network.packets = [];
        console.log('Simulation reset: Network state cleared.');
    }
    
    setSpeed(speed) {
        this.speed = speed;
        
        if (this.running) {
            // Restart with new speed
            this.pause();
            this.start();
        }
    }
    
    step() {
        this.simulationStep++;
        
        if (this.simulationStep % 2 === 1) {
            // Odd steps: Hello packets
            this.network.simulateHelloPackets();
            const packets = [...this.network.packets];
            this.network.packets = [];
            this.visualization.visualizePackets(packets);
        } else {
            // Even steps: LSPs
            const packets = this.network.simulateLSPs();
            this.visualization.visualizePackets(packets);
            
            // Update routing tables display
            this.updateRoutingTablesDisplay();
        }
    }
    
    updateRoutingTablesDisplay() {
        const container = document.getElementById('routing-table-container');
        container.innerHTML = '';
        
        for (const node of this.network.nodes.values()) {
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
            
            // Add separator
            if (Array.from(this.network.nodes.values()).indexOf(node) < this.network.nodes.size - 1) {
                const separator = document.createElement('hr');
                container.appendChild(separator);
            }
        }
    }
}