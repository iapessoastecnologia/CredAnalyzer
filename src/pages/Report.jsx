import { useNavigate, useLocation } from 'react-router-dom';
import { useRef, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../contexts/AuthContext';
import { generatePdfFromHtml } from '../utils/reportUtils';
import { saveReport } from '../firebase/reportStorage';
import '../styles/Report.css';

function Report() {
  const navigate = useNavigate();
  const location = useLocation();
  const reportContentRef = useRef(null);
  const { currentUser } = useAuth();
  const [savingReport, setSavingReport] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [backendAvailable, setBackendAvailable] = useState(false);

  const analysis = location.state?.analysis || "Nenhuma análise disponível.";

  // Verificar se o backend está disponível
  useEffect(() => {
    const checkBackendFirebase = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/firebase_status/');
        if (response.ok) {
          const data = await response.json();
          setBackendAvailable(data.available && data.initialized);
        } else {
          setBackendAvailable(false);
        }
      } catch (error) {
        console.error('Erro ao verificar backend Firebase:', error);
        setBackendAvailable(false);
      }
    };
    
    checkBackendFirebase();
  }, []);

  // Efeito para salvar o relatório no Firestore quando o componente for montado
  useEffect(() => {
    const saveReportToFirestore = async () => {
      if (!currentUser) {
        console.log('Usuário não autenticado, relatório não será salvo');
        return;
      }
      
      try {
        setSavingReport(true);
        
        // Obter dados de planejamento do localStorage
        const planningDataJson = localStorage.getItem('planningData');
        const planningData = planningDataJson ? JSON.parse(planningDataJson) : {};
        
        // Obter os documentos enviados
        const analysisFiles = {};
        if (location.state && location.state.files) {
          location.state.files.forEach(file => {
            // Tentar identificar o tipo de arquivo com base no nome ou metadados
            let fileType = file.documentType || null;
            
            if (!fileType) {
              const fileName = file.name.toLowerCase();
              
              if (fileName.includes('imposto') || fileName.includes('ir')) {
                fileType = 'incomeTax';
              } else if (fileName.includes('registro')) {
                fileType = 'registration';
              } else if (fileName.includes('fiscal') || fileName.includes('situacao')) {
                fileType = 'taxStatus';
              } else if (fileName.includes('faturamento') && fileName.includes('fiscal')) {
                fileType = 'taxBilling';
              } else if (fileName.includes('faturamento') && fileName.includes('gerencial')) {
                fileType = 'managementBilling';
              }
            }
            
            if (fileType) {
              analysisFiles[fileType] = file;
            }
          });
        }
        
        let result;
        
        // Salvar usando backend ou frontend
        if (backendAvailable) {
          // Preparar dados para enviar ao backend
          const formData = new FormData();
          
          // Adicionar arquivos
          if (analysisFiles && Object.keys(analysisFiles).length > 0) {
            Object.entries(analysisFiles).forEach(([key, file]) => {
              if (file) {
                formData.append('files', file);
              }
            });
          }
          
          // Preparar dados do relatório
          const reportData = {
            user_id: currentUser.uid,
            user_name: currentUser.displayName || currentUser.email,
            planning_data: planningData,
            report_content: analysis
          };
          
          // Adicionar dados do relatório como JSON string
          formData.append('report_data', JSON.stringify(reportData));
          
          // Enviar para o backend
          const response = await fetch('http://127.0.0.1:8000/save_report/', {
            method: 'POST',
            body: formData
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Erro ao salvar relatório no backend');
          }
          
          result = await response.json();
        } else {
          // Usar função do frontend para salvar diretamente no Firestore
          result = await saveReport(
            currentUser.uid,
            currentUser.displayName || currentUser.email,
            planningData,
            analysisFiles,
            analysis // Enviando o conteúdo do relatório como texto
          );
        }
        
        if (result.success) {
          setSavedSuccess(true);
        } else {
          throw new Error(result.error || 'Erro desconhecido ao salvar relatório');
        }
      } catch (error) {
        console.error('Erro ao salvar relatório:', error);
        setError('Não foi possível salvar o relatório: ' + error.message);
      } finally {
        setSavingReport(false);
      }
    };
    
    saveReportToFirestore();
  }, [currentUser, location.state, analysis, backendAvailable]);

  const handleDownloadPDF = async () => {
    // Obter o conteúdo HTML do relatório
    const reportContent = reportContentRef.current.innerHTML;
    
    // Gerar e abrir a janela de impressão
    generatePdfFromHtml(reportContent);
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  return (
    <div className="report-container">
      <h1>Relatório de Análise</h1>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      {savingReport && (
        <div className="saving-message">
          Salvando relatório...
        </div>
      )}
      
      {savedSuccess && (
        <div className="success-message">
          Relatório salvo com sucesso!
        </div>
      )}

      <div className="report-actions">
        <button
          className="download-button"
          onClick={handleDownloadPDF}
        >
          Baixar Relatório PDF
        </button>

        <button
          className="home-button"
          onClick={handleBackToHome}
        >
          Voltar ao Início
        </button>
      </div>

      <div className="report-content">
        <div className="markdown-container" ref={reportContentRef}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysis}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

export default Report;