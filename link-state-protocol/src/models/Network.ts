import { Node } from './Node';
import { Position, Packet } from './types';

export class Network {
  nodes: Map<number, Node>;
  packets: Packet[];
  nextNodeId: number;

  constructor() {
    this.nodes = new Map<number, Node>();
    this.packets = [];
    this.nextNodeId = 1;
  }

  createNode(position: Position): Node {
    const id = this.nextNodeId++;
    const node = new Node(id, position);
    this.nodes.set(id, node);
    return node;
  }

  removeNode(nodeId: number): boolean {
    if (!this.nodes.has(nodeId)) {
      return false;
    }
    
    // Remove all links to this node and clean up topology databases
    for (const node of this.nodes.values()) {
      // Remove direct links
      if (node.links.has(nodeId)) {
        node.removeLink(nodeId);
      }
      
      // Remove the deleted node from topology database
      if (node.topologyDatabase.has(nodeId)) {
        node.topologyDatabase.delete(nodeId);
      }
      
      // Remove the deleted node from all other nodes' topology databases
      for (const [sourceNodeId, nodeLinks] of node.topologyDatabase.entries()) {
        if (nodeLinks.has(nodeId)) {
          nodeLinks.delete(nodeId);
        }
      }
      
      // Remove the deleted node from routing table
      if (node.routingTable.has(nodeId)) {
        node.routingTable.delete(nodeId);
      }
      
      // Recalculate routing table since topology has changed
      node.calculateRoutingTable();
    }
    
    // Remove the node itself
    this.nodes.delete(nodeId);
    return true;
  }

  createLink(nodeId1: number, nodeId2: number, cost: number = 1): boolean {
    const node1 = this.getNode(nodeId1);
    const node2 = this.getNode(nodeId2);
    
    if (!node1 || !node2) {
      return false;
    }
    
    node1.addLink(node2, cost);
    node2.addLink(node1, cost);
    
    // Recalculate routing tables
    node1.calculateRoutingTable();
    node2.calculateRoutingTable();
    
    return true;
  }

  removeLink(nodeId1: number, nodeId2: number): boolean {
    const node1 = this.getNode(nodeId1);
    const node2 = this.getNode(nodeId2);
    
    if (!node1 || !node2) {
      return false;
    }
    
    node1.removeLink(nodeId2);
    node2.removeLink(nodeId1);
    
    // Recalculate routing tables
    node1.calculateRoutingTable();
    node2.calculateRoutingTable();
    
    return true;
  }

  getNode(nodeId: number): Node | undefined {
    return this.nodes.get(nodeId);
  }

  simulateHelloPackets(): Packet[] {
    const allPackets: Packet[] = [];
    
    for (const node of this.nodes.values()) {
      if (node.active) {
        const packets = node.sendHelloPackets(this);
        allPackets.push(...packets);
      }
    }
    
    this.packets = allPackets;
    return allPackets;
  }

  simulateNodeHelloPackets(nodeId: number): Packet[] {
    const node = this.getNode(nodeId);
    if (!node || !node.active) {
      return [];
    }
    
    const packets = node.sendHelloPackets(this);
    this.packets = packets;
    return packets;
  }

  getNodeNeighbors(nodeId: number): {neighborId: number, cost: number}[] {
    const node = this.getNode(nodeId);
    if (!node) {
      return [];
    }
    
    const neighbors: {neighborId: number, cost: number}[] = [];
    node.links.forEach((cost, neighborId) => {
      neighbors.push({ neighborId, cost });
    });
    
    return neighbors;
  }

  simulateLSPs(): Packet[] {
    const allPackets: Packet[] = [];
    
    // Each node generates LSPs
    for (const node of this.nodes.values()) {
      if (node.active) {
        const packets = node.sendLSPs(this);
        allPackets.push(...packets);
      }
    }
    
    // Process LSP packets
    const forwardPackets: Packet[] = [];
    
    for (const packet of allPackets) {
      const targetNode = this.getNode(packet.to);
      if (targetNode && targetNode.active) {
        const newPackets = targetNode.receiveLSP(packet, this);
        forwardPackets.push(...newPackets);
      }
    }
    
    // Add forwarded packets
    allPackets.push(...forwardPackets);
    
    this.packets = allPackets;
    return allPackets;
  }

  // Method to create initial network topology
  createInitialTopology(): void {
    // Create nodes
    this.createNode({ x: -3, y: 0, z: 0 });
    this.createNode({ x: 0, y: 3, z: 0 });
    this.createNode({ x: 3, y: 0, z: 0 });
    this.createNode({ x: 0, y: -3, z: 0 });
    this.createNode({ x: 0, y: 0, z: 3 });
    
    // Create links
    this.createLink(1, 2, 1);
    this.createLink(2, 3, 1);
    this.createLink(3, 4, 1);
    this.createLink(4, 1, 1);
    this.createLink(5, 1, 2);
    this.createLink(5, 3, 2);
  }
} 