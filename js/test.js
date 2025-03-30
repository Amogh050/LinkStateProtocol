// Create a test network
const network = new Network();

// Create nodes
const node1 = network.createNode({ x: 0, y: 0 });
const node2 = network.createNode({ x: 100, y: 0 });
const node3 = network.createNode({ x: 50, y: 100 });

// Create links
network.createLink(1, 2, 10); // Link between node1 and node2 with cost 10
network.createLink(2, 3, 5);  // Link between node2 and node3 with cost 5
network.createLink(1, 3, 20); // Link between node1 and node3 with cost 20

// Add dynamic node creation
document.getElementById('add-node').addEventListener('click', () => {
    const x = Math.random() * 100 - 50;
    const y = Math.random() * 100 - 50;
    const node = network.createNode({ x, y });
    console.log(`Node ${node.id} added at (${x}, ${y})`);
});

// Add dynamic link creation
document.getElementById('add-link').addEventListener('click', () => {
    const nodeId1 = parseInt(prompt('Enter first node ID:'));
    const nodeId2 = parseInt(prompt('Enter second node ID:'));
    const cost = parseInt(prompt('Enter link cost:'));
    network.createLink(nodeId1, nodeId2, cost);
    console.log(`Link added between Node ${nodeId1} and Node ${nodeId2} with cost ${cost}`);
});

// Test Hello packets
console.log("Testing Hello Packets:");
const helloPackets = network.simulateHelloPackets();
console.log(helloPackets);

// Test LSP flooding
console.log("\nTesting LSP Flooding:");
const lspPackets = network.simulateLSPs();
console.log(lspPackets);

// Print routing tables
console.log("\nRouting Tables:");
for (const [nodeId, node] of network.nodes.entries()) {
    console.log(`Node ${nodeId} routing table:`, Object.fromEntries(node.routingTable));
}

// Test link failure
console.log("\nTesting link failure:");
network.removeLink(1, 2);
console.log("After removing link between nodes 1 and 2:");
for (const [nodeId, node] of network.nodes.entries()) {
    console.log(`Node ${nodeId} routing table:`, Object.fromEntries(node.routingTable));
}