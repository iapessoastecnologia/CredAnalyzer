import { useNavigate } from 'react-router-dom';
import '../styles/Report.css';

function Report() {
  const navigate = useNavigate();
  
  const handleDownloadPDF = () => {
    // Placeholder for PDF download logic
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
          <p>A funcionalidade de chat estará disponível aqui.</p>
          <p>Você poderá fazer perguntas sobre sua análise.</p>
        </div>
      </div>
    </div>
  );
}

export default Report; 