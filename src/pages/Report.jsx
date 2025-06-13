import { useNavigate, useLocation } from 'react-router-dom';
import { useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import '../styles/Report.css';

function Report() {
  const navigate = useNavigate();
  const location = useLocation();
  const reportContentRef = useRef(null);

  const analysis = location.state?.analysis || "Nenhuma análise disponível.";

  const handleDownloadPDF = () => {
    // Obter o conteúdo HTML do relatório
    const reportContent = reportContentRef.current.innerHTML;
    
    // Armazenar o conteúdo em uma variável global para que o template possa acessá-lo
    window.reportContent = reportContent;
    
    // Abrir o template de impressão em uma nova janela
    const printWindow = window.open('./assets/print-template.html', '_blank', 'width=800,height=600');
    
    // Limpar a variável global após a impressão
    printWindow.onafterprint = function() {
      window.reportContent = null;
    };
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  return (
    <div className="report-container">
      <h1>Relatório de Análise</h1>

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