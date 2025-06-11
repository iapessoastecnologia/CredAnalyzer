import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Planning.css';

function Planning() {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    segment: '',
    otherSegment: '',
    objective: '',
    otherObjective: '',
    creditAmount: '',
    timeInCompany: ''
  });
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: value
    }));
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    navigate('/analysis');
  };
  
  const segments = ['Varejo', 'Indústria', 'Serviços', 'Tecnologia', 'Saúde', 'Educação', 'Outro'];
  const objectives = ['Capital de Giro', 'Expansão', 'Renegociação de Dívidas', 'Compra de Equipamentos', 'Outro'];
  
  return (
    <div className="planning-container">
      <h1>Planejamento</h1>
      
      <form onSubmit={handleSubmit} className="planning-form">
        <div className="form-group">
          <label htmlFor="segment">Segmento da Empresa:</label>
          <select 
            id="segment" 
            name="segment" 
            value={formData.segment} 
            onChange={handleChange}
            required
          >
            <option value="">Selecione um segmento</option>
            {segments.map((segment) => (
              <option key={segment} value={segment}>{segment}</option>
            ))}
          </select>
        </div>
        
        {formData.segment === 'Outro' && (
          <div className="form-group">
            <label htmlFor="otherSegment">Especifique o Segmento:</label>
            <input 
              type="text" 
              id="otherSegment" 
              name="otherSegment" 
              value={formData.otherSegment} 
              onChange={handleChange}
              required
            />
          </div>
        )}
        
        <div className="form-group">
          <label htmlFor="objective">Objetivo do Crédito Buscado:</label>
          <select 
            id="objective" 
            name="objective" 
            value={formData.objective} 
            onChange={handleChange}
            required
          >
            <option value="">Selecione um objetivo</option>
            {objectives.map((objective) => (
              <option key={objective} value={objective}>{objective}</option>
            ))}
          </select>
        </div>
        
        {formData.objective === 'Outro' && (
          <div className="form-group">
            <label htmlFor="otherObjective">Especifique o Objetivo:</label>
            <input 
              type="text" 
              id="otherObjective" 
              name="otherObjective" 
              value={formData.otherObjective} 
              onChange={handleChange}
              required
            />
          </div>
        )}
        
        <div className="form-group">
          <label htmlFor="creditAmount">Valor do Crédito Buscado (R$):</label>
          <input 
            type="number" 
            id="creditAmount" 
            name="creditAmount" 
            value={formData.creditAmount} 
            onChange={handleChange}
            min="1"
            step="0.01"
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="timeInCompany">Tempo na Empresa (anos):</label>
          <input 
            type="number" 
            id="timeInCompany" 
            name="timeInCompany" 
            value={formData.timeInCompany} 
            onChange={handleChange}
            min="0.1"
            step="0.1"
            required
          />
        </div>
        
        <button type="submit" className="continue-button">Continuar</button>
      </form>
    </div>
  );
}

export default Planning; 