import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Analysis.css';

function Analysis() {
  const navigate = useNavigate();
  
  const [selectedDocuments, setSelectedDocuments] = useState({
    incomeTax: false,
    registration: false,
    taxStatus: false,
    managementBilling: false,
    taxBilling: false
  });
  
  const [files, setFiles] = useState({
    incomeTax: null,
    registration: null,
    taxStatus: null,
    managementBilling: null,
    taxBilling: null
  });
  
  const handleCheckboxChange = (e) => {
    const { name, checked } = e.target;
    setSelectedDocuments(prev => ({
      ...prev,
      [name]: checked
    }));
    
    // Reset file if checkbox is unchecked
    if (!checked) {
      setFiles(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };
  
  const handleFileChange = (e) => {
    const { name, files } = e.target;
    setFiles(prev => ({
      ...prev,
      [name]: files[0]
    }));
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    navigate('/processing');
  };
  
  return (
    <div className="analysis-container">
      <h1>Análise de Documentos</h1>
      
      <form onSubmit={handleSubmit} className="document-form">
        <div className="document-selection">
          <h2>Selecione os documentos para enviar:</h2>
          
          <div className="document-item">
            <label>
              <input 
                type="checkbox" 
                name="incomeTax" 
                checked={selectedDocuments.incomeTax} 
                onChange={handleCheckboxChange}
              />
              Imposto de Renda
            </label>
            {selectedDocuments.incomeTax && (
              <div className="file-upload">
                <input 
                  type="file" 
                  name="incomeTax" 
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                />
              </div>
            )}
          </div>
          
          <div className="document-item">
            <label>
              <input 
                type="checkbox" 
                name="registration" 
                checked={selectedDocuments.registration} 
                onChange={handleCheckboxChange}
              />
              Registro
            </label>
            {selectedDocuments.registration && (
              <div className="file-upload">
                <input 
                  type="file" 
                  name="registration" 
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                />
              </div>
            )}
          </div>
          
          <div className="document-item">
            <label>
              <input 
                type="checkbox" 
                name="taxStatus" 
                checked={selectedDocuments.taxStatus} 
                onChange={handleCheckboxChange}
              />
              Situação Fiscal
            </label>
            {selectedDocuments.taxStatus && (
              <div className="file-upload">
                <input 
                  type="file" 
                  name="taxStatus" 
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                />
              </div>
            )}
          </div>
          
          <div className="document-item">
            <label>
              <input 
                type="checkbox" 
                name="managementBilling" 
                checked={selectedDocuments.managementBilling} 
                onChange={handleCheckboxChange}
              />
              Faturamento Gerencial
            </label>
            {selectedDocuments.managementBilling && (
              <div className="file-upload">
                <input 
                  type="file" 
                  name="managementBilling" 
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                />
              </div>
            )}
          </div>
          
          <div className="document-item">
            <label>
              <input 
                type="checkbox" 
                name="taxBilling" 
                checked={selectedDocuments.taxBilling} 
                onChange={handleCheckboxChange}
              />
              Faturamento Fiscal
            </label>
            {selectedDocuments.taxBilling && (
              <div className="file-upload">
                <input 
                  type="file" 
                  name="taxBilling" 
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                />
              </div>
            )}
          </div>
        </div>
        
        <button 
          type="submit" 
          className="send-documents-button"
        >
          Enviar Documentos
        </button>
      </form>
    </div>
  );
}

export default Analysis; 