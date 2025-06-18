import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import logo from '../assets/logo.png';

function Navbar() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchUserData() {
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, "usuarios", currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUserName(userData.nome || '');
          }
        } catch (error) {
          console.error("Erro ao buscar dados do usuário:", error);
        }
      }
    }

    fetchUserData();
  }, [currentUser]);

  // Não mostrar a navbar na página de login
  if (location.pathname === '/login') {
    return null;
  }

  async function handleLogout() {
    try {
      setLoading(true);
      await logout();
      navigate('/');
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleLogin() {
    navigate('/login');
  }

  function handleProfileClick() {
    navigate('/profile');
  }

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-logo">
          <Link to="/" className="logo-link">
            <img src={logo} alt="Logo" className="logo-image" />
          </Link>
        </div>
        
        <div className="navbar-title">
          <Link to="/" className="title-link">
            <h1>Cred<span className="highlight">Analyzer</span></h1>
          </Link>
        </div>
        
        <div className="navbar-user">
          {currentUser ? (
            <>
              {userName && (
                <span 
                  className="user-name"
                  onClick={handleProfileClick}
                  style={{ cursor: 'pointer' }}
                >
                  Olá, {userName}
                </span>
              )}
              <button 
                onClick={handleLogout} 
                disabled={loading}
                className="logout-button"
              >
                {loading ? 'Saindo...' : 'Sair'}
              </button>
            </>
          ) : (
            <button 
              onClick={handleLogin}
              className="login-button"
            >
              Entrar
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar; 