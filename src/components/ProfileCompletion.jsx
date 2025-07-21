import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { maskPhone } from '../utils/maskUtils';

function ProfileCompletion({ onSuccess }) {
  const { currentUser, updateUserData } = useAuth();
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentUser?.displayName) {
      setNome(currentUser.displayName);
    }
    
    if (currentUser?.phoneNumber) {
      setTelefone(maskPhone(currentUser.phoneNumber));
    }
  }, [currentUser]);

  const handleTelefoneChange = (e) => {
    setTelefone(maskPhone(e.target.value));
  };

  async function handleSubmit(e) {
    e.preventDefault();

    if (!nome.trim()) {
      return setError('O nome é obrigatório');
    }

    if (!telefone.trim()) {
      return setError('O telefone é obrigatório');
    }

    try {
      setError('');
      setLoading(true);
      
      await updateUserData(currentUser.uid, {
        nome,
        telefone,
        isProfileComplete: true
      });
      
      onSuccess();
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      setError('Falha ao atualizar perfil');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-form">
      <h2>Complete seu Perfil</h2>
      <p>Para continuar, precisamos de algumas informações adicionais.</p>
      
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
          <label htmlFor="telefone">Telefone</label>
          <input
            type="tel"
            id="telefone"
            value={telefone}
            onChange={handleTelefoneChange}
            placeholder="(XX) XXXXX-XXXX"
            required
          />
        </div>
        
        <button type="submit" disabled={loading} className="auth-button">
          {loading ? 'Salvando...' : 'Continuar'}
        </button>
      </form>
    </div>
  );
}

export default ProfileCompletion; 