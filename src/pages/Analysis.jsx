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
    managementBilling: false,
    spcSerasa: false,
    statement: false
  });

  const [files, setFiles] = useState({
    incomeTax: [],
    registration: [],
    taxStatus: [],
    taxBilling: [],
    managementBilling: [],
    spcSerasa: [],
    statement: []
  });
  
  // Carregar estado salvo quando o componente monta
  useEffect(() => {
    const savedSelections = localStorage.getItem('analysisSelectedDocuments');
    if (savedSelections) {
      try {
        const parsedSelections = JSON.parse(savedSelections);
        // Garantir que os novos campos estejam incluídos
        setSelectedDocuments({
          ...selectedDocuments,
          ...parsedSelections,
          // Força a inclusão dos novos campos mesmo se não estiverem no localStorage
          managementBilling: parsedSelections.managementBilling || false,
          spcSerasa: parsedSelections.spcSerasa || false
        });
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
      setFiles(prev => ({ ...prev, [name]: [] }));
    }
  };

  const handleFileChange = (e) => {
    const { name, files: selectedFiles } = e.target;
    
    if (selectedFiles.length > 0) {
      const fileType = getFileType(name);
      
      // Criar cópias dos arquivos com metadados adicionais
      const filesWithMetadata = Array.from(selectedFiles).map(file => {
        const fileCopy = file;
        fileCopy.documentType = name; // Adicionar metadados para identificar o tipo do documento
        return fileCopy;
      });
      
      // Adicionar os novos arquivos ao array existente
      setFiles(prev => ({
        ...prev,
        [name]: [...prev[name], ...filesWithMetadata]
      }));
      
      // Limpar o input de arquivo para permitir selecionar o mesmo arquivo novamente
      e.target.value = '';
    }
  };
  
  const handleRemoveFile = (category, index) => {
    setFiles(prev => ({
      ...prev,
      [category]: prev[category].filter((_, i) => i !== index)
    }));
  };
  
  // Função para obter o tipo de arquivo em português para o nome
  const getFileType = (key) => {
    const types = {
      incomeTax: 'ImpostoRenda',
      registration: 'Registrato',
      taxStatus: 'SituacaoFiscal',
      taxBilling: 'FaturamentoFiscal',
      managementBilling: 'FaturamentoGerencial',
      spcSerasa: 'SpcOuSerasa',
      statement: 'Demonstrativo'
    };
    return types[key] || key;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Combinar todos os arquivos de todas as categorias em um único array
    const filesToSend = Object.entries(selectedDocuments)
      .filter(([key, checked]) => checked && files[key].length > 0)
      .flatMap(([key]) => files[key]);
    
    // Salvar informações sobre os arquivos enviados no localStorage
    const filesInfo = Object.entries(selectedDocuments)
      .filter(([key, checked]) => checked && files[key].length > 0)
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
                  <input type="file" name={key} onChange={handleFileChange} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" multiple />
                  <div className="file-upload-info">
                    Você pode selecionar múltiplos arquivos de uma vez pressionando Ctrl (ou Cmd) ao selecionar
                  </div>
                  
                  {files[key].length > 0 && (
                    <div className="files-list">
                      {files[key].map((file, index) => (
                        <div key={index} className="file-entry">
                          <span className="file-name">{file.name}</span>
                          <button 
                            type="button" 
                            className="remove-file" 
                            onClick={() => handleRemoveFile(key, index)}
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>
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
            !Object.entries(selectedDocuments).some(([key, selected]) => selected && files[key].length > 0)}
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
    registration: 'Registrato',
    taxStatus: 'Situação Fiscal',
    taxBilling: 'Faturamento Fiscal',
    managementBilling: 'Faturamento Gerencial',
    spcSerasa: 'SPC ou Serasa',
    statement: 'Demonstrativo'
  };
  return labels[key];
};

export default Analysis;