import { useState } from 'react';
import './Triangles.css';

const Triangles = () => {
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState('Click để bắt đầu!');

  const handleTriangleClick = () => {
    setScore(score + 1);
    setMessage(`Điểm: ${score + 1} 🎉`);
  };

  const handleReset = () => {
    setScore(0);
    setMessage('Click để bắt đầu!');
  };

  return (
    <div className="triangles-container">
      <div className="triangles-header">
        <h2>🔺 Game Tam Giác</h2>
        <p className="message">{message}</p>
        <button onClick={handleReset} className="reset-btn">
          Chơi lại
        </button>
      </div>
      
      <div className="triangles-grid">
        {[...Array(9)].map((_, index) => (
          <div
            key={index}
            className="triangle"
            onClick={handleTriangleClick}
          >
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <polygon
                points="50,10 90,90 10,90"
                fill="#4CAF50"
                stroke="#2E7D32"
                strokeWidth="2"
              />
            </svg>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Triangles;
