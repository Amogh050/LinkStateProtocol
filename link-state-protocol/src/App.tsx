import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import { Network } from './models/Network';
import { Simulation } from './models/Simulation';
import { SimulationStatus, Packet } from './models/types';
import NetworkVisualization from './components/visualization/NetworkVisualization';
import NetworkControls from './components/controls/NetworkControls';
import SimulationControls from './components/controls/SimulationControls';

function App() {
  // Add a force update counter to trigger re-renders
  const [updateCounter, setUpdateCounter] = useState(0);
  
  const [network] = useState<Network>(() => {
    const newNetwork = new Network();
    newNetwork.createInitialTopology();
    return newNetwork;
  });
  
  const [simulationState, setSimulationState] = useState<{
    simulation: Simulation;
    status: SimulationStatus;
    packets: Packet[];
  }>(() => {
    const newSimulation = new Simulation(
      network,
      handleSimulationStep,
      handleStatusChange
    );
    
    return {
      simulation: newSimulation,
      status: { ...newSimulation.status },
      packets: []
    };
  });

  function handleSimulationStep() {
    setSimulationState(prevState => ({
      ...prevState,
      packets: [...network.packets],
      status: { ...prevState.simulation.status }
    }));
  }

  function handleStatusChange(status: SimulationStatus) {
    setSimulationState(prevState => ({
      ...prevState,
      status: { ...status }
    }));
  }

  // Improved network update handler
  const handleNetworkUpdate = useCallback(() => {
    // Increment update counter to force re-render
    setUpdateCounter(counter => counter + 1);
    
    // Update simulation state
    setSimulationState(prevState => ({
      ...prevState,
      packets: [...network.packets]
    }));
    
    console.log('Network updated, triggering re-render');
  }, [network]);

  // Cleanup simulation on unmount
  useEffect(() => {
    return () => {
      if (simulationState.simulation.simulationInterval) {
        clearInterval(simulationState.simulation.simulationInterval);
      }
    };
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Link-State Routing Protocol Visualization</h1>
      </header>
      
      <div className="main-container">
        <div className="sidebar">
          <NetworkControls 
            network={network} 
            onNetworkUpdate={handleNetworkUpdate} 
          />
          
          <SimulationControls 
            simulation={simulationState.simulation} 
            network={network}
          />
        </div>
        
        <div className="visualization-area">
          <NetworkVisualization 
            network={network} 
            packets={simulationState.packets}
            key={`network-vis-${updateCounter}`} 
          />
        </div>
      </div>
    </div>
  );
}

export default App; 