import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Planning from './pages/Planning';
import Analysis from './pages/Analysis';
import Processing from './pages/Processing';
import Report from './pages/Report';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/planning" element={<Planning />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/processing" element={<Processing />} />
          <Route path="/report" element={<Report />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
