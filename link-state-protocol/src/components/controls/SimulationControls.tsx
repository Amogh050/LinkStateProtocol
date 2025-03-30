import React from 'react';
import { Simulation } from '../../models/Simulation';
import { SimulationStatus } from '../../models/types';

interface SimulationControlsProps {
  simulation: Simulation;
  status: SimulationStatus;
}

const SimulationControls: React.FC<SimulationControlsProps> = ({ simulation, status }) => {
  const handleStartSimulation = () => {
    simulation.start();
  };

  const handlePauseSimulation = () => {
    simulation.pause();
  };

  const handleResetSimulation = () => {
    simulation.reset();
  };

  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const speed = parseInt(e.target.value);
    simulation.setSpeed(speed);
  };

  const handleStepSimulation = () => {
    simulation.step();
  };

  return (
    <div className="simulation-controls">
      <h2>Simulation Controls</h2>
      <div className="status">
        <div>Status: {status.status.charAt(0).toUpperCase() + status.status.slice(1)}</div>
        <div>Speed: {status.speed}</div>
        <div>Step: {status.step}</div>
      </div>
      <div className="buttons">
        <button onClick={handleStartSimulation} disabled={status.status === 'running'}>
          Start
        </button>
        <button onClick={handlePauseSimulation} disabled={status.status !== 'running'}>
          Pause
        </button>
        <button onClick={handleStepSimulation} disabled={status.status === 'running'}>
          Step
        </button>
        <button onClick={handleResetSimulation}>
          Reset
        </button>
      </div>
      <div className="speed-control">
        <label htmlFor="speed-slider">Speed:</label>
        <input
          type="range"
          id="speed-slider"
          min="1"
          max="10"
          value={status.speed}
          onChange={handleSpeedChange}
        />
      </div>
    </div>
  );
};

export default SimulationControls; 