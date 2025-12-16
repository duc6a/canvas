import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Canvas from './components/Canvas';
import Triangles from './components/Triangles';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <nav className="nav-bar">
          <div className="nav-content">
            <div className="nav-links">
              <Link to="/" className="nav-link">
                <span className="nav-icon">🎨</span>
                Canvas Drawing
              </Link>
              <Link to="/triangles" className="nav-link">
                <span className="nav-icon">🔺</span>
                Triangles Game
              </Link>
            </div>
          </div>
        </nav>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<Canvas />} />
            <Route path="/triangles" element={<Triangles />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
