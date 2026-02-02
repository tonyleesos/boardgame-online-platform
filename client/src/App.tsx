import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import './App.css';
import gameImage from './assets/time-bomb-placeholder.svg';

// Style object for better readability
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#282c34',
    color: 'white',
  },
  input: {
    margin: '10px 0',
    padding: '8px',
    fontSize: '16px',
  },
  button: {
    padding: '10px 20px',
    fontSize: '16px',
    cursor: 'pointer',
    backgroundColor: '#61dafb',
    border: 'none',
    borderRadius: '5px',
  },
  gameCard: {
    border: '2px solid #61dafb',
    borderRadius: '10px',
    padding: '20px',
    margin: '20px',
    cursor: 'pointer',
    textAlign: 'center',
  },
  gameImage: {
    width: '150px',
    marginBottom: '10px',
  }
};

// Define component props for type safety
interface CharacterSelectProps {
  setNickname: (name: string) => void;
  setStage: (stage: string) => void;
}

const CharacterSelect = ({ setNickname, setStage }: CharacterSelectProps) => {
  const [name, setName] = useState('');

  const handleSubmit = () => {
    if (name.trim()) {
      setNickname(name);
      setStage('LOBBY');
    }
  };

  return (
    <div style={styles.container}>
      <h2>Enter Your Nickname</h2>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nickname"
        style={styles.input}
      />
      <button onClick={handleSubmit} style={styles.button}>
        Confirm
      </button>
    </div>
  );
};

interface LobbyProps {
    nickname: string;
    setStage: (stage: string) => void;
}

const Lobby = ({ nickname, setStage }: LobbyProps) => {
  return (
    <div style={styles.container}>
      <h2>Welcome, {nickname}!</h2>
      <button onClick={() => setStage('GAME_SELECT')} style={styles.button}>
        Enter Game Lobby
      </button>
    </div>
  );
};

interface GameSelectProps {
    setStage: (stage: string) => void;
}

const GameSelect = ({ setStage }: GameSelectProps) => {
  return (
    <div style={styles.container}>
      <h2>Choose a Game</h2>
      <div style={styles.gameCard} onClick={() => setStage('GAME_ROOM')}>
        <img src={gameImage} alt="Time Bomb Evolution" style={styles.gameImage} />
        <h3>Time Bomb Evolution</h3>
      </div>
    </div>
  );
};

interface GameRoomProps {
    nickname: string;
}

const GameRoom = ({ nickname }: GameRoomProps) => {
  const [roomCode, setRoomCode] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Connect to the server when the component mounts
    // Make sure the server is running on localhost:3001
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setMessage('Connected to the server!');
    });

    newSocket.on('message', (msg) => {
      console.log('Message from server:', msg);
    });

    // Disconnect on cleanup
    return () => {
      newSocket.disconnect();
    };
  }, []);

  const handleJoinRoom = () => {
    if (socket && roomCode.trim()) {
      socket.emit('joinRoom', { roomCode, nickname });
      setMessage(`Joined room: ${roomCode}`);
    }
  };

  return (
    <div style={styles.container}>
      <h2>Game Room</h2>
      <p>Welcome, {nickname}!</p>
      <input
        type="text"
        value={roomCode}
        onChange={(e) => setRoomCode(e.target.value)}
        placeholder="Enter Room Code"
        style={styles.input}
      />
      <button onClick={handleJoinRoom} style={styles.button}>
        Join Room
      </button>
      <p>{message}</p>
    </div>
  );
};


function App() {
  const [stage, setStage] = useState('CHARACTER');
  const [nickname, setNickname] = useState('');

  const renderStage = () => {
    switch (stage) {
      case 'LOBBY':
        return <Lobby nickname={nickname} setStage={setStage} />;
      case 'GAME_SELECT':
        return <GameSelect setStage={setStage} />;
      case 'GAME_ROOM':
        return <GameRoom nickname={nickname} />;
      case 'CHARACTER':
      default:
        return <CharacterSelect setNickname={setNickname} setStage={setStage} />;
    }
  };

  return <div className="App">{renderStage()}</div>;
}

export default App;