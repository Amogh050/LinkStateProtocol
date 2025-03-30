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
  
  // Simplified to keep API compatibility - not used in new UI
  start(): void {
    this.status.status = 'running';
    this.onStatusChange({ ...this.status });
  }
  
  // Simplified to keep API compatibility - not used in new UI
  pause(): void {
    this.status.status = 'paused';
    this.onStatusChange({ ...this.status });
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
  
  // Simplified to keep API compatibility - not used in new UI
  setSpeed(speed: number): void {
    this.status.speed = speed;
    this.onStatusChange({ ...this.status });
  }
  
  // Step function now just notifies about updates
  step(): void {
    this.status.step++;
    this.onSimulationStep();
  }
  
  // New function to handle hello packets specifically
  sendHelloPackets(): void {
    this.network.simulateHelloPackets();
    this.status.step++;
    this.onSimulationStep();
  }
} 