import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/Report.css';

function Report() {
  const navigate = useNavigate();
  const location = useLocation();

  const analysis = location.state?.analysis || "Nenhuma análise disponível.";

  const handleDownloadPDF = () => {
    alert('A funcionalidade de download de PDF será implementada no futuro.');
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

      <div className="chat-container">
        <h2>Chat Contextualizado</h2>
        <div className="chat-placeholder">
          <pre style={{whiteSpace: 'pre-wrap'}}>{analysis}</pre>
        </div>
      </div>
    </div>
  );
}

export default Report;