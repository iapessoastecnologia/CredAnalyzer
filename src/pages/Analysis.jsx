import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/Analysis.css';

function Analysis() {
  const navigate = useNavigate();

  const [selectedDocuments, setSelectedDocuments] = useState({
    incomeTax: false,
    registration: false,
    taxStatus: false,
    taxBilling: false,
    managementBilling: false
  });

  const [files, setFiles] = useState({
    incomeTax: null,
    registration: null,
    taxStatus: null,
    taxBilling: null,
    managementBilling: null
  });
  
  // Carregar estado salvo quando o componente monta
  useEffect(() => {
    const savedSelections = localStorage.getItem('analysisSelectedDocuments');
    if (savedSelections) {
      try {
        const parsedSelections = JSON.parse(savedSelections);
        setSelectedDocuments(parsedSelections);
      } catch (error) {
        console.error('Erro ao carregar seleções salvas:', error);
      }
    }
  }, []);

  const handleCheckboxChange = (e) => {
    const { name, checked } = e.target;
    const updatedSelections = { ...selectedDocuments, [name]: checked };
    
    setSelectedDocuments(updatedSelections);
    
    // Salvar seleções atualizadas no localStorage
    localStorage.setItem('analysisSelectedDocuments', JSON.stringify(updatedSelections));
    
    if (!checked) {
      setFiles(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleFileChange = (e) => {
    const { name, files } = e.target;
    
    // Adicionar um prefixo ao nome do arquivo para facilitar a identificação posterior
    if (files[0]) {
      // Criar um novo objeto File com o mesmo conteúdo, mas com nome modificado
      const fileType = getFileType(name);
      const newFileName = `${fileType}_${files[0].name}`;
      
      // Não podemos modificar o arquivo diretamente, então armazenamos metadados adicionais
      const fileWithMetadata = files[0];
      fileWithMetadata.documentType = name; // Adicionar metadados para identificar o tipo do documento
      
      setFiles(prev => ({ ...prev, [name]: fileWithMetadata }));
    } else {
      setFiles(prev => ({ ...prev, [name]: null }));
    }
  };
  
  // Função para obter o tipo de arquivo em português para o nome
  const getFileType = (key) => {
    const types = {
      incomeTax: 'ImpostoRenda',
      registration: 'Registro',
      taxStatus: 'SituacaoFiscal',
      taxBilling: 'FaturamentoFiscal',
      managementBilling: 'FaturamentoGerencial'
    };
    return types[key] || key;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Filtrar apenas os arquivos que foram selecionados (checked)
    const filesToSend = Object.entries(selectedDocuments)
      .filter(([key, checked]) => checked && files[key])
      .map(([key]) => files[key]);
    
    // Salvar informações sobre os arquivos enviados no localStorage
    const filesInfo = Object.entries(selectedDocuments)
      .filter(([key, checked]) => checked && files[key])
      .reduce((acc, [key]) => {
        acc[key] = true;
        return acc;
      }, {});
    
    localStorage.setItem('analysisFilesInfo', JSON.stringify(filesInfo));
    
    navigate('/processing', { state: { files: filesToSend } });
  };
  
  const handleBack = () => {
    navigate('/planning');
  };

  return (
    <div className="analysis-container">
      <button className="back-button" onClick={handleBack}>Voltar</button>
      <h1>Análise de Documentos</h1>
      <form onSubmit={handleSubmit} className="document-form">
        <div className="document-selection">
          <h2>Selecione os documentos para enviar:</h2>
          {Object.entries(selectedDocuments).map(([key, selected]) => (
            <div className="document-item" key={key}>
              <label>
                <input type="checkbox" name={key} checked={selected} onChange={handleCheckboxChange} />
                {getLabel(key)}
              </label>
              {selected && (
                <div className="file-upload">
                  <input type="file" name={key} onChange={handleFileChange} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
                  {files[key] && (
                    <span className="file-name">{files[key].name}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        <button 
          type="submit" 
          className="send-documents-button" 
          disabled={!Object.values(selectedDocuments).some(Boolean) || 
            !Object.entries(selectedDocuments).some(([key, selected]) => selected && files[key])}
        >
          Enviar Documentos
        </button>
      </form>
    </div>
  );
}

const getLabel = (key) => {
  const labels = {
    incomeTax: 'Imposto de Renda',
    registration: 'Registro',
    taxStatus: 'Situação Fiscal',
    taxBilling: 'Faturamento Fiscal',
    managementBilling: 'Faturamento Gerencial'
  };
  return labels[key];
};

export default Analysis;