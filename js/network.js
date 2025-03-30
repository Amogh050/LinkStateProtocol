class Node {
    constructor(id, position) {
        this.id = id;
        this.position = position;
        this.links = new Map(); // Map of nodeId -> link cost
        this.topologyDatabase = new Map(); // Map of nodeId -> Map of neighborId -> cost
        this.routingTable = new Map(); // Map of destinationId -> {nextHop, cost}
        this.color = new THREE.Color(0x3498db);
        this.active = true;
    }

    addLink(targetNode, cost) {
        if (!this.links.has(targetNode.id)) {
            this.links.set(targetNode.id, cost);
            // Add to local topology database
            if (!this.topologyDatabase.has(this.id)) {
                this.topologyDatabase.set(this.id, new Map());
            }
            this.topologyDatabase.get(this.id).set(targetNode.id, cost);
        }
    }

    removeLink(targetNodeId) {
        if (this.links.has(targetNodeId)) {
            this.links.delete(targetNodeId);
            // Update local topology database
            if (this.topologyDatabase.has(this.id)) {
                this.topologyDatabase.get(this.id).delete(targetNodeId);
            }
        }
    }

    sendHelloPackets(network) {
        if (!this.active) return [];
        
        const packets = [];
        for (const [neighborId, cost] of this.links.entries()) {
            const neighbor = network.getNode(neighborId);
            if (neighbor && neighbor.active) {
                packets.push({
                    type: 'HELLO',
                    from: this.id,
                    to: neighborId,
                    data: { senderId: this.id }
                });
            }
        }
        return packets;
    }

    sendLSPs(network) {
        if (!this.active) return [];
        
        const packets = [];
        const lspData = {
            nodeId: this.id,
            links: Array.from(this.links.entries()).map(([nodeId, cost]) => ({ nodeId, cost }))
        };

        for (const [neighborId] of this.links.entries()) {
            const neighbor = network.getNode(neighborId);
            if (neighbor && neighbor.active) {
                packets.push({
                    type: 'LSP',
                    from: this.id,
                    to: neighborId,
                    data: lspData
                });
            }
        }
        return packets;
    }

    receiveLSP(lsp, network) {
        if (!this.active) return [];
        
        const sourceNodeId = lsp.data.nodeId;
        const linksData = lsp.data.links;
        
        // Check if we already have this information
        let isNewInfo = false;
        
        if (!this.topologyDatabase.has(sourceNodeId)) {
            this.topologyDatabase.set(sourceNodeId, new Map());
            isNewInfo = true;
        }
        
        const nodeLinks = this.topologyDatabase.get(sourceNodeId);
        
        for (const link of linksData) {
            if (!nodeLinks.has(link.nodeId) || nodeLinks.get(link.nodeId) !== link.cost) {
                nodeLinks.set(link.nodeId, link.cost);
                isNewInfo = true;
            }
        }
        
        // Forward LSP to neighbors if it's new information
        const forwardPackets = [];
        if (isNewInfo) {
            for (const [neighborId] of this.links.entries()) {
                if (neighborId !== lsp.from) { // Don't send back to the sender
                    const neighbor = network.getNode(neighborId);
                    if (neighbor && neighbor.active) {
                        forwardPackets.push({
                            type: 'LSP',
                            from: this.id,
                            to: neighborId,
                            data: lsp.data
                        });
                    }
                }
            }
            
            // Recalculate routing table
            this.calculateRoutingTable();
        }
        
        return forwardPackets;
    }

    calculateRoutingTable() {
        // Implementation of Dijkstra's algorithm
        const distances = new Map();
        const previous = new Map();
        const unvisited = new Set();
        
        // Initialize distances
        for (const nodeId of this.topologyDatabase.keys()) {
            distances.set(nodeId, Infinity);
            unvisited.add(nodeId);
        }
        
        distances.set(this.id, 0);
        
        while (unvisited.size > 0) {
            // Find the unvisited node with the smallest distance
            let current = null;
            let smallestDistance = Infinity;
            
            for (const nodeId of unvisited) {
                const distance = distances.get(nodeId);
                if (distance < smallestDistance) {
                    smallestDistance = distance;
                    current = nodeId;
                }
            }
            
            if (current === null || smallestDistance === Infinity) {
                break; // No more reachable nodes
            }
            
            unvisited.delete(current);
            
            // Check neighbors of current node
            const neighbors = this.topologyDatabase.get(current);
            if (!neighbors) continue;
            
            for (const [neighborId, cost] of neighbors.entries()) {
                if (!unvisited.has(neighborId)) continue;
                
                const newDistance = distances.get(current) + cost;
                if (newDistance < distances.get(neighborId)) {
                    distances.set(neighborId, newDistance);
                    previous.set(neighborId, current);
                }
            }
        }
        
        // Build routing table
        this.routingTable.clear();
        
        for (const [nodeId, distance] of distances.entries()) {
            if (nodeId === this.id || distance === Infinity) continue;
            
            // Find the next hop
            let nextHop = nodeId;
            let currentNode = nodeId;
            
            while (previous.get(currentNode) !== this.id && previous.has(currentNode)) {
                currentNode = previous.get(currentNode);
                nextHop = currentNode;
            }
            
            this.routingTable.set(nodeId, {
                nextHop: nextHop,
                cost: distance
            });
        }
    }
}

class Network {
    constructor() {
        this.nodes = new Map();
        this.packets = [];
        this.nextNodeId = 1;
    }

    createNode(position) {
        const id = this.nextNodeId++;
        const node = new Node(id, position);
        this.nodes.set(id, node);
        return node;
    }

    removeNode(nodeId) {
        if (this.nodes.has(nodeId)) {
            const node = this.nodes.get(nodeId);
            
            // Remove all links to this node
            for (const otherNode of this.nodes.values()) {
                otherNode.removeLink(nodeId);
            }
            
            this.nodes.delete(nodeId);
            
            // Recalculate routing tables for all nodes
            for (const node of this.nodes.values()) {
                node.calculateRoutingTable();
            }
        }
    }

    createLink(nodeId1, nodeId2, cost = 1) {
        const node1 = this.nodes.get(nodeId1);
        const node2 = this.nodes.get(nodeId2);

        if (!node1 || !node2) {
            console.error(`Cannot create link: Node ${nodeId1} or Node ${nodeId2} does not exist.`);
            return;
        }

        node1.addLink(node2, cost);
        node2.addLink(node1, cost);
        
        // Recalculate routing tables
        node1.calculateRoutingTable();
        node2.calculateRoutingTable();
    }

    removeLink(nodeId1, nodeId2) {
        const node1 = this.nodes.get(nodeId1);
        const node2 = this.nodes.get(nodeId2);

        if (!node1 || !node2) {
            console.error(`Cannot remove link: Node ${nodeId1} or Node ${nodeId2} does not exist.`);
            return;
        }

        node1.removeLink(nodeId2);
        node2.removeLink(nodeId1);
        
        // Recalculate routing tables
        node1.calculateRoutingTable();
        node2.calculateRoutingTable();
    }

    getNode(nodeId) {
        return this.nodes.get(nodeId);
    }

    simulateHelloPackets() {
        this.packets = [];
        
        for (const node of this.nodes.values()) {
            const helloPackets = node.sendHelloPackets(this);
            this.packets.push(...helloPackets);
        }
    }

    simulateLSPs() {
        let newPackets = [];
        
        for (const node of this.nodes.values()) {
            const lsps = node.sendLSPs(this);
            newPackets.push(...lsps);
        }
        
        this.packets.push(...newPackets);
        
        // Process LSP propagation
        let processedPackets = [];
        while (this.packets.length > 0) {
            const packet = this.packets.shift();
            processedPackets.push(packet);
            
            if (packet.type === 'LSP') {
                const targetNode = this.getNode(packet.to);
                if (targetNode && targetNode.active) {
                    const forwardPackets = targetNode.receiveLSP(packet, this);
                    this.packets.push(...forwardPackets);
                }
            }
        }
        
        return processedPackets;
    }
}