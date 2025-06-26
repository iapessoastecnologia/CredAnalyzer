import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Home from './pages/Home';
import Planning from './pages/Planning';
import Analysis from './pages/Analysis';
import Processing from './pages/Processing';
import Report from './pages/Report';
import Profile from './pages/Profile';
import Login from './pages/Login';
import Navbar from './components/Navbar';
import './App.css';
import './styles/navbar.css';
import Payment from './pages/Payment';
import Wallet from './pages/Wallet';

// Componente para rotas protegidas
function ProtectedRoute({ children }) {
  const { currentUser } = useAuth();
  
  if (!currentUser) {
    // Redirecionar para a página de login se não estiver autenticado
    return <Navigate to="/login" replace />;
  }
  
  return children;
}

function App() {
  return (
    <Router>
      <div className="app">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/planning" element={
            <ProtectedRoute>
              <Planning />
            </ProtectedRoute>
          } />
          <Route path="/processing" element={
            <ProtectedRoute>
              <Processing />
            </ProtectedRoute>
          } />
          <Route path="/analysis" element={
            <ProtectedRoute>
              <Analysis />
            </ProtectedRoute>
          } />
          <Route path="/report" element={
            <ProtectedRoute>
              <Report />
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />
          <Route path="/payment" element={
            <ProtectedRoute>
              <Payment />
            </ProtectedRoute>
          } />
          <Route path="/wallet" element={
            <ProtectedRoute>
              <Wallet />
            </ProtectedRoute>
          } />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
