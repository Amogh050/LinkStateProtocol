import { Network } from './Network';
import { SimulationStatus } from './types';

export class Simulation {
  network: Network;
  status: SimulationStatus;
  simulationInterval: ReturnType<typeof setTimeout> | null;
  onSimulationStep: () => void;
  onStatusChange: (status: SimulationStatus) => void;

  constructor(
    network: Network, 
    onSimulationStep: () => void, 
    onStatusChange: (status: SimulationStatus) => void
  ) {
    this.network = network;
    this.status = {
      status: 'paused',
      speed: 5,
      step: 0
    };
    this.simulationInterval = null;
    this.onSimulationStep = onSimulationStep;
    this.onStatusChange = onStatusChange;
  }
  
  start(): void {
    if (this.status.status !== 'running') {
      this.status.status = 'running';
      const intervalTime = 2000 / this.status.speed; // Adjust timing based on speed
      
      this.simulationInterval = setInterval(() => {
        this.step();
      }, intervalTime);
      
      this.onStatusChange({ ...this.status });
    }
  }
  
  pause(): void {
    if (this.status.status === 'running') {
      this.status.status = 'paused';
      
      if (this.simulationInterval) {
        clearInterval(this.simulationInterval);
        this.simulationInterval = null;
      }
      
      this.onStatusChange({ ...this.status });
    }
  }
  
  reset(): void {
    this.pause();
    this.status.step = 0;
    this.status.status = 'reset';
    
    // Clear network state
    this.network = new Network();
    this.network.createInitialTopology();
    
    this.onStatusChange({ ...this.status });
    this.onSimulationStep();
  }
  
  setSpeed(speed: number): void {
    this.status.speed = speed;
    
    if (this.status.status === 'running') {
      // Restart with new speed
      this.pause();
      this.start();
    } else {
      this.onStatusChange({ ...this.status });
    }
  }
  
  step(): void {
    this.status.step++;
    
    if (this.status.step % 2 === 1) {
      // Odd steps: Hello packets
      this.network.simulateHelloPackets();
    } else {
      // Even steps: LSPs
      this.network.simulateLSPs();
    }
    
    this.onSimulationStep();
  }

  // Modified function to handle hello packets for a specific node
  sendHelloPackets(nodeId: number): void {
    // Send hello packets for the specific node
    this.network.simulateNodeHelloPackets(nodeId);
    this.status.step++;
    this.onSimulationStep();
  }
} 