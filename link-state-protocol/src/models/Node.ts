import { Color } from 'three';
import { Position, Route, Link, Packet, LSPData } from './types';

export class Node {
  id: number;
  position: Position;
  links: Map<number, number>; // Map of nodeId -> link cost
  topologyDatabase: Map<number, Map<number, number>>; // Map of nodeId -> Map of neighborId -> cost
  routingTable: Map<number, Route>; // Map of destinationId -> {nextHop, cost}
  color: Color;
  active: boolean;
  lsp: LSPData; // Link State Packet data
  private lspSequenceNumber: number;

  constructor(id: number, position: Position) {
    this.id = id;
    this.position = position;
    this.links = new Map<number, number>();
    this.topologyDatabase = new Map<number, Map<number, number>>();
    this.routingTable = new Map<number, Route>();
    this.color = new Color(0x3498db);
    this.active = true;
    this.lspSequenceNumber = 0;
    this.lsp = {
      nodeId: id,
      links: [],
      sequenceNumber: this.lspSequenceNumber
    };
  }

  addLink(targetNode: Node, cost: number): void {
    if (!this.links.has(targetNode.id)) {
      this.links.set(targetNode.id, cost);
      // Add to local topology database
      if (!this.topologyDatabase.has(this.id)) {
        this.topologyDatabase.set(this.id, new Map<number, number>());
      }
      this.topologyDatabase.get(this.id)?.set(targetNode.id, cost);
      // Update LSP
      this.updateLSP();
    }
  }

  removeLink(targetNodeId: number): void {
    if (this.links.has(targetNodeId)) {
      this.links.delete(targetNodeId);
      // Update local topology database
      if (this.topologyDatabase.has(this.id)) {
        this.topologyDatabase.get(this.id)?.delete(targetNodeId);
      }
      // Update LSP
      this.updateLSP();
    }
  }

  private updateLSP(): void {
    this.lspSequenceNumber++;
    this.lsp = {
      nodeId: this.id,
      links: Array.from(this.links.entries()).map(([nodeId, cost]) => ({ nodeId, cost })),
      sequenceNumber: this.lspSequenceNumber
    };
  }

  sendHelloPackets(network: any): Packet[] {
    if (!this.active) return [];
    
    const packets: Packet[] = [];
    for (const [neighborId, cost] of this.links.entries()) {
      const neighbor = network.getNode(neighborId);
      if (neighbor && neighbor.active) {
        packets.push({
          type: 'HELLO',
          from: this.id,
          to: neighborId,
          data: { 
            senderId: this.id,
            cost: cost,  // Include the link cost in the packet
            lsp: this.lsp
          }
        });
      }
    }
    return packets;
  }

  sendLSPs(network: any): Packet[] {
    if (!this.active) return [];
    
    const packets: Packet[] = [];
    const lspData: LSPData = {
      nodeId: this.id,
      links: Array.from(this.links.entries()).map(([nodeId, cost]) => ({ nodeId, cost })),
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

  receiveLSP(lsp: Packet, network: any): Packet[] {
    if (!this.active) return [];
    
    const sourceNodeId = lsp.data.nodeId;
    const linksData = lsp.data.links;
    const ttl = lsp.data.ttl;
    
    // If TTL is 0, don't forward the packet
    if (ttl <= 0) {
      return [];
    }
    
    // Check if we already have this information
    let isNewInfo = false;
    
    if (!this.topologyDatabase.has(sourceNodeId)) {
      this.topologyDatabase.set(sourceNodeId, new Map<number, number>());
      isNewInfo = true;
    }
    
    const nodeLinks = this.topologyDatabase.get(sourceNodeId);
    
    for (const link of linksData) {
      if (!nodeLinks?.has(link.nodeId) || nodeLinks.get(link.nodeId) !== link.cost) {
        nodeLinks?.set(link.nodeId, link.cost);
        isNewInfo = true;
      }
    }
    
    // Forward LSP to neighbors if TTL > 0
    const forwardPackets: Packet[] = [];
    for (const [neighborId] of this.links.entries()) {
      if (neighborId !== lsp.from) { // Don't send back to the sender
        const neighbor = network.getNode(neighborId);
        if (neighbor && neighbor.active) {
          // Create a new packet with the same direction as the original
          forwardPackets.push({
            type: 'LSP',
            from: this.id, // Use current node as sender for the forwarded packet
            to: neighborId,
            data: {
              ...lsp.data,
              ttl: ttl - 1  // Decrement TTL
            }
          });
        }
      }
    }
    
    return forwardPackets;
  }

  calculateRoutingTable(): void {
    // Clear existing routing table
    this.routingTable.clear();
    
    // If topology database is empty, don't calculate routes
    if (this.topologyDatabase.size === 0) {
      return;
    }

    // Implementation of Dijkstra's algorithm
    const distances = new Map<number, number>();
    const previous = new Map<number, number>();
    const unvisited = new Set<number>();
    
    // Initialize distances for all known nodes from topology database
    for (const [nodeId, _] of this.topologyDatabase) {
      distances.set(nodeId, Infinity);
      unvisited.add(nodeId);
    }
    
    // Add direct neighbors if they're not in topology database yet
    for (const [neighborId, cost] of this.links) {
      if (!distances.has(neighborId)) {
        distances.set(neighborId, Infinity);
        unvisited.add(neighborId);
      }
    }
    
    // Set distance to self as 0
    distances.set(this.id, 0);
    
    while (unvisited.size > 0) {
      // Find the unvisited node with the smallest distance
      let current: number | null = null;
      let smallestDistance = Infinity;
      
      for (const nodeId of unvisited) {
        const distance = distances.get(nodeId) || Infinity;
        if (distance < smallestDistance) {
          smallestDistance = distance;
          current = nodeId;
        }
      }
      
      if (current === null || smallestDistance === Infinity) {
        break; // No more reachable nodes
      }
      
      unvisited.delete(current);
      
      // Check neighbors of current node from topology database
      const neighbors = this.topologyDatabase.get(current);
      if (neighbors) {
        for (const [neighborId, cost] of neighbors.entries()) {
          if (!unvisited.has(neighborId)) continue;
          
          const newDistance = (distances.get(current) || 0) + cost;
          if (newDistance < (distances.get(neighborId) || Infinity)) {
            distances.set(neighborId, newDistance);
            previous.set(neighborId, current);
          }
        }
      }
    }
    
    // Build routing table only for nodes with valid paths
    for (const [nodeId, distance] of distances.entries()) {
      if (nodeId === this.id || distance === Infinity) continue;
      
      // Find the next hop
      let nextHop = nodeId;
      let currentNode = nodeId;
      
      while (previous.get(currentNode) !== this.id && previous.has(currentNode)) {
        currentNode = previous.get(currentNode) || 0;
        nextHop = currentNode;
      }
      
      if (previous.has(currentNode)) { // Only add if there is a valid path
        this.routingTable.set(nodeId, {
          nextHop: nextHop,
          cost: distance
        });
      }
    }
  }
} 