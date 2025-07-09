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
  const { currentUser, decrementReportsLeft } = useAuth();
  const [savingReport, setSavingReport] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [backendAvailable, setBackendAvailable] = useState(false);

  // Referência para controlar se o relatório já foi salvo durante esta sessão
  const hasAttemptedSaveRef = useRef(false);

  const analysis = location.state?.analysis || "Nenhuma análise disponível.";

  // Criar um identificador de relatório estável
  const reportId = useRef(
    localStorage.getItem('lastReportId') ||
    `report-${currentUser?.uid || 'guest'}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`
  );

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

  // Verificar se há dados no localStorage e definir novamente se necessário
  useEffect(() => {
    if (!localStorage.getItem(`report-saved-${reportId.current}`)) {
      // Se não houver registro de que este relatório foi salvo, preparar para salvá-lo
      console.log('Não há registro de salvamento para este relatório:', reportId.current);
      hasAttemptedSaveRef.current = false;
    }
  }, []);

  // Função para salvar o relatório manualmente ou automaticamente
  const saveReportToFirestore = async (forceOverride = false) => {
    if (!currentUser) {
      console.log('Usuário não autenticado, relatório não será salvo');
      return;
    }

    // Verificar se temos dados suficientes para salvar
    if (analysis === "Nenhuma análise disponível.") {
      console.log('Sem análise para salvar');
      return;
    }

    try {
      setSavingReport(true);
      setError(null);

      // Se forçar o salvamento, resetar o status
      if (forceOverride) {
        localStorage.removeItem(`report-saved-${reportId.current}`);
      }

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
      let usedBackend = false;

      console.log('Salvando relatório, forceOverride=', forceOverride);

      // Primeiro tentar usar o backend
      if (backendAvailable) {
        try {
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
            report_content: analysis,
            report_identifier: forceOverride ? `${reportId.current}-force-${Date.now()}` : reportId.current
          };

          // Adicionar dados do relatório como JSON string
          formData.append('report_data', JSON.stringify(reportData));

          // Enviar para o backend
          const response = await fetch('http://127.0.0.1:8000/save_report/', {
            method: 'POST',
            body: formData,
            // Adicionando timeout para não esperar indefinidamente
            signal: AbortSignal.timeout(10000) // 10 segundos de timeout
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Erro ao salvar relatório no backend');
          }

          result = await response.json();
          usedBackend = true;
        } catch (backendError) {
          console.error('Erro ao usar o backend, tentando salvamento direto:', backendError);
          // Não lançar o erro aqui, continuaremos com o salvamento direto
        }
      }

      // Se o backend falhou ou não está disponível, usar o salvamento direto
      if (!usedBackend || !result || !result.success) {
        console.log('Usando salvamento direto pelo frontend');
        // Usar função do frontend para salvar diretamente no Firestore
        result = await saveReport(
          currentUser.uid,
          currentUser.displayName || currentUser.email,
          planningData,
          analysisFiles,
          analysis,
          forceOverride ? `${reportId.current}-force-${Date.now()}` : reportId.current
        );
      }

      if (result.success) {
        // Decrementar créditos disponíveis do usuário
        const decrementResult = await decrementReportsLeft(currentUser.uid);

        if (!decrementResult.success) {
          throw new Error('Erro ao decrementar créditos');
        }

        // Marcar relatório como salvo no localStorage
        localStorage.setItem(`report-saved-${reportId.current}`, 'true');
        localStorage.setItem('lastReportId', reportId.current);
        setSavedSuccess(true);

        // Se o relatório já existia, considerar como sucesso também
        if (result.alreadyExists) {
          console.log('Relatório já existia no Firestore, considerando como salvo');
          setSavedSuccess(true);
        }
      } else {
        throw new Error(result.error || 'Erro desconhecido ao salvar relatório');
      }
    } catch (error) {
      console.error('Erro ao salvar relatório:', error);
      setError('Não foi possível salvar o relatório: ' + error.message);
      setSavedSuccess(false);

      // Se houver erro, tentar salvar diretamente após um breve intervalo
      if (!error.message.includes('Erro de rede')) {
        // Tentar novamente com uma abordagem diferente após 2 segundos
        setTimeout(() => {
          console.log('Tentando novamente com abordagem alternativa...');
          saveReportToFirestore(true);
        }, 2000);
      }
    } finally {
      setSavingReport(false);
    }
  };

  // Efeito para salvar o relatório no Firestore quando o componente for montado
  // No componente Report, substitua o useEffect de salvamento por este:

  useEffect(() => {
    const reportSaveKey = `report-saved-${reportId.current}`;
    const isSavedLocally = localStorage.getItem(reportSaveKey) === 'true';

    // Se já tentamos salvar antes (via localStorage), verificar uma vez no Firebase
    if (isSavedLocally && !hasAttemptedSaveRef.current) {
      console.log('Relatório marcado como salvo no localStorage, verificando no Firebase...');

      // Salvar o relatório com um identificador forçado único
      // Isso garante que não haverá duplicação, pois o backend e a função saveReport
      // verificam se já existe conteúdo idêntico
      const uniqueIdentifier = `${reportId.current}-verify-${Date.now()}`;

      // Marcamos que já tentamos para não repetir
      hasAttemptedSaveRef.current = true;

      // Salvar usando o identificador único
      setTimeout(() => {
        console.log('Verificando e salvando com ID único:', uniqueIdentifier);
        saveReportToFirestore(true); // O true forçará usando um novo ID único
      }, 500);

      return;
    }

    // Se não está marcado como salvo, salvar normalmente
    if (!isSavedLocally) {
      console.log('Iniciando salvamento do relatório:', reportId.current);
      hasAttemptedSaveRef.current = true;

      // Executar o salvamento com um pequeno atraso
      const timer = setTimeout(() => {
        saveReportToFirestore(false);
      }, 100);

      return () => clearTimeout(timer);
    }

    // Se já verificamos anteriormente e está no localStorage, apenas exibir mensagem
    if (isSavedLocally && hasAttemptedSaveRef.current) {
      console.log('Relatório verificado e confirmado como salvo');
      setSavedSuccess(true);
    }
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
          className="download-btn"
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