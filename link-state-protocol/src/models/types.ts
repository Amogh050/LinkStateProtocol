import type { Color, Vector3 } from 'three';

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface Route {
  nextHop: number;
  cost: number;
}

export interface Link {
  nodeId: number;
  cost: number;
}

export type PacketType = 'HELLO' | 'LSP';

export interface Packet {
  type: PacketType;
  from: number;
  to: number;
  data: any;
}

export interface HelloPacketData {
  senderId: number;
}

export interface LSPData {
  nodeId: number;
  links: Link[];
  sequenceNumber?: number;
}

export interface NodeVisual {
  position: Vector3;
  color: Color;
}

export interface LinkVisual {
  line: any;
  costSprite: any;
}

export interface SimulationStatus {
  status: 'running' | 'paused' | 'reset';
  speed: number;
  step: number;
} 