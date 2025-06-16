import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

function RegisterForm({ onToggleMode, onSuccess }) {
  const { register } = useAuth();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      return setError('As senhas não coincidem');
    }

    try {
      setError('');
      setLoading(true);
      
      await register(email, password, {
        nome,
        telefone,
        isProfileComplete: true
      });
      
      onSuccess();
    } catch (error) {
      console.error("Erro ao cadastrar:", error);
      setError(
        error.code === 'auth/email-already-in-use'
          ? 'Este email já está em uso'
          : error.code === 'auth/weak-password'
          ? 'A senha deve ter pelo menos 6 caracteres'
          : 'Falha ao criar conta'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-form">
      <h2>Criar Conta</h2>
      {error && <div className="auth-error">{error}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="nome">Nome</label>
          <input
            type="text"
            id="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          />
        </div>
        
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
          <label htmlFor="telefone">Telefone</label>
          <input
            type="tel"
            id="telefone"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
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
        
        <div className="form-group">
          <label htmlFor="confirmPassword">Confirmar Senha</label>
          <input
            type="password"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
        
        <button type="submit" disabled={loading} className="auth-button">
          {loading ? 'Criando conta...' : 'Cadastrar'}
        </button>
      </form>
      
      <p className="auth-toggle">
        Já possui uma conta?{' '}
        <button onClick={onToggleMode} className="auth-link">
          Entrar
        </button>
      </p>
    </div>
  );
}

export default RegisterForm; 