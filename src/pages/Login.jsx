import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import RegisterForm from '../components/RegisterForm';
import ProfileCompletion from '../components/ProfileCompletion';
import googleIcon from '../assets/google-icon.svg';
import '../styles/auth.css';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

function Login() {
    const navigate = useNavigate();
    const { currentUser, login, loginWithGoogle } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState('login'); // 'login', 'register', 'profile-completion'
    const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);

    useEffect(() => {
        // Verificar se o usuário já está logado
        if (currentUser) {
            checkProfileCompletion();
        }
    }, [currentUser]);

    async function checkProfileCompletion() {
        if (!currentUser) return;

        try {
            const userDoc = await getDoc(doc(db, "usuarios", currentUser.uid));
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                
                if (userData.isProfileComplete) {
                    // Perfil completo, redirecionar para a página inicial
                    navigate('/');
                } else {
                    // Perfil incompleto, mostrar formulário de complemento
                    setNeedsProfileCompletion(true);
                    setMode('profile-completion');
                }
            } else {
                // Documento do usuário não existe, mostrar formulário de complemento
                setNeedsProfileCompletion(true);
                setMode('profile-completion');
            }
        } catch (error) {
            console.error("Erro ao verificar perfil:", error);
            setError("Erro ao verificar perfil. Tente novamente.");
        }
    }

    async function handleLogin(e) {
        e.preventDefault();
        
        try {
            setError('');
            setLoading(true);
            await login(email, password);
            navigate('/');
        } catch (error) {
            console.error("Erro de login:", error);
            setError(
                error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password'
                    ? 'Email ou senha incorretos'
                    : 'Falha ao fazer login'
            );
        } finally {
            setLoading(false);
        }
    }

    async function handleGoogleLogin() {
        try {
            setError('');
            setLoading(true);
            await loginWithGoogle();
            // A verificação de perfil será feita no useEffect quando currentUser mudar
        } catch (error) {
            console.error("Erro ao fazer login com Google:", error);
            setError('Falha ao fazer login com Google');
            setLoading(false);
        }
    }

    function handleToggleMode() {
        setMode(mode === 'login' ? 'register' : 'login');
        setError('');
    }

    function handleProfileCompleted() {
        navigate('/');
    }

    function handleBackToHome() {
        navigate('/');
    }

    if (needsProfileCompletion) {
        return (
            <div className="login-container">
                <ProfileCompletion onSuccess={handleProfileCompleted} />
            </div>
        );
    }

    return (
        <div className="login-container">
            <button onClick={handleBackToHome} className="back-button">
                Voltar para Home
            </button>
            
            {mode === 'login' ? (
                <div className="auth-form">
                    <h2>Login</h2>
                    {error && <div className="auth-error">{error}</div>}
                    
                    <form onSubmit={handleLogin}>
                        <div className="form-group">
                            <label htmlFor="email">Email</label>
                            <input
                                type="email"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        
                        <div className="form-group">
                            <label htmlFor="password">Senha</label>
                            <input
                                type="password"
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        
                        <button type="submit" disabled={loading} className="auth-button">
                            {loading ? 'Entrando...' : 'Entrar'}
                        </button>
                    </form>
                    
                    <div className="auth-divider">
                        <span>ou</span>
                    </div>
                    
                    <button 
                        onClick={handleGoogleLogin} 
                        disabled={loading}
                        className="google-button"
                    >
                        <img src={googleIcon} alt="Google" />
                        Entrar com Google
                    </button>
                    
                    <p className="auth-toggle">
                        Não tem uma conta?{' '}
                        <button onClick={handleToggleMode} className="auth-link">
                            Cadastre-se
                        </button>
                    </p>
                </div>
            ) : (
                <RegisterForm 
                    onToggleMode={handleToggleMode} 
                    onSuccess={() => navigate('/')} 
                />
            )}
        </div>
    );
}

export default Login;