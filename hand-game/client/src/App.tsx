import { GameCanvas } from './components/GameCanvas';
import useHandControl from './hooks/useHandControl';

function App() {
  const {data:handleData, toggleFilter} = useHandControl('ws://localhost:8765');

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', margin: 0, padding: 0 }}>
      {/* 
        You could add a rigorous UI layer here, but we'll draw everything in canvas for performance 
        and synchronization with the game loop.
      */}
      <GameCanvas handData={handleData} onToggleFilter={toggleFilter} />

      {/* Overlay instructions if detection is missing for a while could go here */}
    </div>
  );
}

export default App;
