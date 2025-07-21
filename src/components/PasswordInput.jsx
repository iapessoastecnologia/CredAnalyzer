import { useState } from 'react';
import openEyeIcon from '../assets/open_eye.svg';
import closeEyeIcon from '../assets/close_eye.svg';

/**
 * Componente de input de senha com opção de visualização
 * @param {Object} props - Propriedades do componente
 * @param {string} props.id - ID do campo
 * @param {string} props.value - Valor do campo
 * @param {function} props.onChange - Função chamada ao alterar o valor
 * @param {boolean} props.required - Se o campo é obrigatório
 * @param {string} props.placeholder - Placeholder do campo
 * @param {string} props.className - Classes adicionais para o container
 * @param {string} props.inputClassName - Classes adicionais para o input
 * @returns {JSX.Element} Componente de input de senha
 */
function PasswordInput({ 
  id, 
  value, 
  onChange, 
  required = false,
  placeholder = '',
  className = '',
  inputClassName = ''
}) {
  const [showPassword, setShowPassword] = useState(false);
  
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };
  
  return (
    <div className={`password-input-container ${className}`}>
      <input
        type={showPassword ? "text" : "password"}
        id={id}
        name={id}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        className={`password-input ${inputClassName}`}
      />
      <button 
        type="button"
        className="password-toggle-button"
        onClick={togglePasswordVisibility}
        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
      >
        <img 
          src={showPassword ? openEyeIcon : closeEyeIcon} 
          alt={showPassword ? "Ocultar senha" : "Mostrar senha"}
          className="password-icon"
        />
      </button>
    </div>
  );
}

export default PasswordInput; 