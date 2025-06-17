import { useState, useEffect } from 'react';
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
  
  // Carregar dados salvos do localStorage ao montar o componente
  useEffect(() => {
    const savedData = localStorage.getItem('planningFormData');
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        
        // Se houver valor de crédito numérico, formatá-lo como moeda
        if (parsedData.creditAmount && typeof parsedData.creditAmount === 'number') {
          parsedData.creditAmount = formatCurrency(String(parsedData.creditAmount * 100));
        }
        
        setFormData(parsedData);
      } catch (error) {
        console.error('Erro ao carregar dados salvos:', error);
      }
    }
  }, []);
  
  // Função para formatar valor como moeda brasileira
  const formatCurrency = (value) => {
    // Remove todos os caracteres não numéricos
    const numericValue = value.replace(/\D/g, '');
    
    // Se não houver valor, retorna vazio
    if (!numericValue) return '';
    
    // Converte para número e divide por 100 para obter o valor em reais
    const floatValue = parseFloat(numericValue) / 100;
    
    // Formata o valor como moeda brasileira
    return floatValue.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };
  
  // Função para remover a formatação e obter apenas o valor numérico
  const unformatCurrency = (value) => {
    // Remove todos os caracteres não numéricos
    return value.replace(/\D/g, '') || '0';
  };
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    let updatedFormData;
    
    if (name === 'creditAmount') {
      // Para o campo de valor, aplica a máscara de moeda
      const unformattedValue = unformatCurrency(value);
      const formattedValue = formatCurrency(unformattedValue);
      
      updatedFormData = {
        ...formData,
        [name]: formattedValue
      };
    } else {
      // Para os outros campos, mantém o comportamento original
      updatedFormData = {
        ...formData,
        [name]: value
      };
    }
    
    // Atualiza o estado e salva no localStorage
    setFormData(updatedFormData);
    localStorage.setItem('planningFormData', JSON.stringify(updatedFormData));
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Antes de salvar, converte o valor formatado para número
    const formDataToSave = { ...formData };
    if (formData.creditAmount) {
      // Remove a formatação e converte para número
      formDataToSave.creditAmount = parseFloat(unformatCurrency(formData.creditAmount)) / 100;
    }
    
    localStorage.setItem('planningData', JSON.stringify(formDataToSave));
    navigate('/analysis');
  };
  
  const handleBack = () => {
    navigate('/');
  };
  
  const segments = ['Varejo', 'Indústria', 'Serviços', 'Tecnologia', 'Saúde', 'Educação', 'Outro'];
  const objectives = ['Capital de Giro', 'Expansão', 'Renegociação de Dívidas', 'Compra de Equipamentos', 'Outro'];

  return (
    <div className="planning-container">
      <button className="back-button" onClick={handleBack}>Voltar</button>
      <h1>Planejamento</h1>
      <form onSubmit={handleSubmit} className="planning-form">
        <div className="form-group">
          <label htmlFor="segment">Segmento da Empresa:</label>
          <select id="segment" name="segment" value={formData.segment} onChange={handleChange} required>
            <option value="">Selecione um segmento</option>
            {segments.map((segment) => (
              <option key={segment} value={segment}>{segment}</option>
            ))}
          </select>
        </div>
        {formData.segment === 'Outro' && (
          <div className="form-group">
            <label htmlFor="otherSegment">Especifique o Segmento:</label>
            <input type="text" id="otherSegment" name="otherSegment" value={formData.otherSegment} onChange={handleChange} required />
          </div>
        )}
        <div className="form-group">
          <label htmlFor="objective">Objetivo do Crédito Buscado:</label>
          <select id="objective" name="objective" value={formData.objective} onChange={handleChange} required>
            <option value="">Selecione um objetivo</option>
            {objectives.map((objective) => (
              <option key={objective} value={objective}>{objective}</option>
            ))}
          </select>
        </div>
        {formData.objective === 'Outro' && (
          <div className="form-group">
            <label htmlFor="otherObjective">Especifique o Objetivo:</label>
            <input type="text" id="otherObjective" name="otherObjective" value={formData.otherObjective} onChange={handleChange} required />
          </div>
        )}
        <div className="form-group">
          <label htmlFor="creditAmount">Valor do Crédito Buscado:</label>
          <input 
            type="text" 
            id="creditAmount" 
            name="creditAmount" 
            value={formData.creditAmount} 
            onChange={handleChange} 
            placeholder="R$ 0,00"
            required 
          />
        </div>
        <div className="form-group">
          <label htmlFor="timeInCompany">Tempo de Empresa (anos):</label>
          <input type="number" id="timeInCompany" name="timeInCompany" value={formData.timeInCompany} onChange={handleChange} min="0.1" step="any" required />
        </div>
        <button type="submit" className="continue-button">Continuar</button>
      </form>
    </div>
  );
}

export default Planning;