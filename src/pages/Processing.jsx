import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/Processing.css';

function Processing() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, userSubscription } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState('Verificando créditos disponíveis...');
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps] = useState(3);
  const [creditosVerificados, setCreditosVerificados] = useState(false);

  const updateProgress = (step, message) => {
    setCurrentStep(step);
    setProgress(message);
  };

  // Verificar créditos antes de processar documentos
  useEffect(() => {
    async function verificarCreditos() {
      if (!currentUser) {
        setError('Usuário não autenticado.');
        setLoading(false);
        return false;
      }

      if (location.state?.fromPayment) {
        try {
          // Forçar atualização dos dados do servidor
          await refreshUserSubscription();

          // Verificação direta do banco de dados após atualização
          const db = firebase.firestore();
          const userDoc = await db.collection('usuarios').doc(currentUser.uid).get();
          const userData = userDoc.data();

          if (userData?.subscription?.reportsLeft > 0) {
            setCreditosVerificados(true);
            return true;
          }
        } catch (err) {
          console.error("Erro ao verificar créditos diretamente:", err);
        }
      }
      try {
        // Verificar se o usuário tem plano e créditos suficientes
        if (!userSubscription || !userSubscription.reportsLeft || userSubscription.reportsLeft <= 0) {
          setError('Você não possui créditos suficientes para gerar relatórios. Adquira um plano para continuar.');
          setLoading(false);

          // Mostrar erro por 3 segundos e depois redirecionar para a página de pagamento
          setTimeout(() => {
            navigate('/payment', { state: { needsUpgrade: true } });
          }, 3000);

          return false;
        }

        // Usuário tem créditos, pode prosseguir
        setCreditosVerificados(true);
        return true;
      } catch (err) {
        console.error("Erro ao verificar créditos:", err);
        setError('Erro ao verificar seus créditos disponíveis. Tente novamente.');
        setLoading(false);
        return false;
      }
    }

    verificarCreditos();
  }, [currentUser, navigate, userSubscription]);

  useEffect(() => {
    // Só continuar o processamento se os créditos já foram verificados e são suficientes
    if (!creditosVerificados) {
      return;
    }

    async function sendFiles() {
      if (!location.state || !location.state.files) {
        setError('Nenhum arquivo enviado para análise.');
        setLoading(false);
        return;
      }

      const files = location.state.files;
      console.log('Enviando arquivos:', files.map(f => f.name));

      const formData = new FormData();
      
      // Criar mapeamento de tipos de documentos para o backend
      const documentTypes = {};
      
      // Adicionar arquivos ao formData e mapear tipos
      files.forEach((file, index) => {
        formData.append('files', file);
        
        // Se o arquivo tiver um tipo de documento definido, adicioná-lo ao mapeamento
        if (file.documentType) {
          // Mapear os tipos internos para os tipos esperados pelo backend
          let backendType = file.documentType;
          
          // Garantir que arquivos SCR/Registrato sejam sempre marcados como 'registrato'
          if (backendType === 'registration' || file.name.toLowerCase().includes('scr') || file.name.toLowerCase().includes('registrato')) {
            backendType = 'registrato';
          } 
          // Converter outros tipos para o formato esperado pelo backend
          else if (backendType === 'cnpjCard') backendType = 'cnpj';
          else if (backendType === 'incomeTax') backendType = 'irpf';
          else if (backendType === 'taxStatus') backendType = 'fiscal';
          else if (backendType === 'taxBilling') backendType = 'faturamento_fiscal';
          else if (backendType === 'managementBilling') backendType = 'faturamento_gerencial';
          else if (backendType === 'spcSerasa') backendType = 'serasa';
          else if (backendType === 'statement') backendType = 'demonstrativo';
          
          // Adicionar ao mapeamento usando o índice como chave
          documentTypes[index] = backendType;
        }
      });
      
      // Adicionar o mapeamento de tipos de documento ao formData se não estiver vazio
      if (Object.keys(documentTypes).length > 0) {
        console.log('Adicionando mapeamento de tipos de documento:', documentTypes);
        formData.append('document_types', JSON.stringify(documentTypes));
      }

      // Obter dados de planejamento do localStorage
      const planningData = localStorage.getItem('planningData');
      if (planningData) {
        console.log('Adicionando dados de planejamento:', planningData);
        formData.append('planning_data', planningData);
      }

      try {
        updateProgress(1, 'Enviando arquivos para o servidor...');
        console.log('Fazendo requisição para:', 'http://127.0.0.1:8000/analyze/');

        const response = await fetch('http://127.0.0.1:8000/analyze/', {
          method: 'POST',
          body: formData,
          // Timeout aumentado para 120 segundos devido ao processamento da IA
          //signal: AbortSignal.timeout(120000)
        });

        console.log('Resposta recebida:', response.status, response.statusText);
        updateProgress(2, 'Extraindo texto dos documentos...');

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Erro na resposta:', errorText);

          // Tentar fazer parse do JSON para pegar detalhes do erro
          let errorMessage;
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.detail || errorText;
          } catch {
            errorMessage = errorText;
          }

          throw new Error(`Erro na API (${response.status}): ${errorMessage}`);
        }

        updateProgress(3, 'Processando análise com Inteligência Artificial...');

        const data = await response.json();
        console.log('Dados recebidos:', data);

        if (data.error) {
          throw new Error(data.error);
        }

        if (!data.success) {
          throw new Error('Processamento não foi concluído com sucesso');
        }

        updateProgress(3, 'Análise concluída! Preparando relatório...');

        // Pequeno delay para mostrar mensagem de sucesso
        setTimeout(() => {
          // Navega para o relatório passando a análise como state
          navigate('/report', {
            state: {
              analysis: data.analysis,
              processedFiles: data.processed_files,
              totalTextLength: data.total_text_length,
              filesProcessed: data.files_processed,
              files: location.state.files // Passar os arquivos enviados para o relatório
            }
          });
        }, 1500);

      } catch (err) {
        console.error('Erro durante o processamento:', err);

        if (err.name === 'TimeoutError') {
          setError('Timeout: O processamento demorou muito. Isso pode acontecer com arquivos grandes ou quando a API da OpenAI está lenta. Tente novamente com arquivos menores.');
        } else if (err.name === 'TypeError' && err.message.includes('fetch')) {
          setError('Erro de conexão: Verifique se o servidor backend está rodando em http://127.0.0.1:8000');
        } else if (err.message.includes('OpenAI')) {
          setError(`Erro na análise AI: ${err.message}. Verifique se a OPENAI_API_KEY está configurada corretamente.`);
        } else {
          setError(`Erro: ${err.message}`);
        }
        setLoading(false);
      }
    }

    // Verificar se o backend está rodando antes de enviar arquivos
    async function checkBackendHealth() {
      try {
        const response = await fetch('http://127.0.0.1:8000/health');
        if (response.ok) {
          const health = await response.json();
          console.log('Status do backend:', health);

          if (!health.openai_configured) {
            setError('Backend está rodando, mas a API da OpenAI não está configurada. Verifique a OPENAI_API_KEY.');
            setLoading(false);
            return;
          }

          // Backend está OK, continuar com o processamento
          sendFiles();
        } else {
          throw new Error('Backend não está respondendo corretamente');
        }
      } catch (err) {
        console.error('Erro ao verificar backend:', err);
        setError('Não foi possível conectar com o servidor. Verifique se o backend está rodando em http://127.0.0.1:8000');
        setLoading(false);
      }
    }

    checkBackendHealth();
  }, [location.state, navigate, creditosVerificados]);

  if (error) {
    return (
      <div className="processing-container">
        <h1>Erro no Processamento</h1>
        <div className="error-details">
          <p className="error-message">{error}</p>
          {error.includes('créditos suficientes') ? (
            <div className="error-help">
              <button
                onClick={() => navigate('/payment')}
                className="upgrade-button"
              >
                Adquirir Plano
              </button>
            </div>
          ) : (
            <div className="error-help">
              <h3>Possíveis soluções:</h3>
              <ul>
                <li>Verifique se o backend está rodando: <code>uvicorn main:app --reload</code></li>
                <li>Verifique se a OPENAI_API_KEY está configurada no arquivo .env</li>
                <li>Tente com arquivos menores (máximo 10MB cada)</li>
                <li>Verifique sua conexão com a internet</li>
              </ul>
            </div>
          )}
        </div>
        <button
          onClick={() => navigate('/analysis')}
          className="back-button"
        >
          Voltar para Seleção de Documentos
        </button>
      </div>
    );
  }

  return (
    <div className="processing-container">
      <div className="processing-background">
        <div className="document"></div>
        <div className="document"></div>
        <div className="document"></div>
        <div className="document"></div>
      </div>
      <div className="processing-content">
        <h1>Processando Documentos</h1>
        <div className="progress-info">
          <p className="progress-text">{progress}</p>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            ></div>
          </div>
          <p className="progress-step">Etapa {currentStep} de {totalSteps}</p>
        </div>
        {loading && <div className="loading-spinner"></div>}

        <div className="processing-steps">
          <div className={`step ${currentStep >= 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}>
            <div className="step-number">1</div>
            <div className="step-text">Upload dos Arquivos</div>
            {currentStep === 1 && (
              <small>* Essa etapa pode demorar um pouco mais do que as demais.</small>
            )}
          </div>
          <div className={`step ${currentStep >= 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}`}>
            <div className="step-number">2</div>
            <div className="step-text">Extração de Texto</div>
          </div>
          <div className={`step ${currentStep >= 3 ? 'active' : ''}`}>
            <div className="step-number">3</div>
            <div className="step-text">Análise por IA</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Processing;