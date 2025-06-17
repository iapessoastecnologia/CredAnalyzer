import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/Home.css';

function Home() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const handleClick = () => {
    if (currentUser) {
      navigate('/planning');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="home-container">
      <main className="hero-section">
        <div className="container">
          <div className="hero-content">
            <h1 className="hero-title">
              Analista de Documentação <span className="highlight">para Crédito</span>
            </h1>
            <p className="hero-description">
              Transforme a análise de documentos para crédito com nossa plataforma impulsionada por inteligência artificial. Obtenha análises precisas, reduza o tempo de processamento e tome decisões mais inteligentes.
            </p>
            <button 
              className="cta-button"
              onClick={handleClick}
            >
              {currentUser ? 'Começar Análise' : 'Entrar para Começar'}
            </button>
          </div>

          <div className="hero-image">
            <div className="image-placeholder">
              <div className="document-icon"></div>
              <div className="analysis-icon"></div>
              <div className="report-icon"></div>
            </div>
          </div>
        </div>
      </main>

      <section className="features-section">
        <div className="container">
          <h2 className="section-title">Como Funciona</h2>
          
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon planning-icon"></div>
              <h3>Planejamento</h3>
              <p>Forneça informações básicas sobre sua empresa e o crédito desejado para personalizar a análise.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon upload-icon"></div>
              <h3>Upload de Documentos</h3>
              <p>Envie seus documentos financeiros e fiscais com segurança através da nossa plataforma.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon processing-icon"></div>
              <h3>Processamento Inteligente</h3>
              <p>Nossa IA analisa seus documentos e extrai informações relevantes com precisão.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon report-icon"></div>
              <h3>Relatório Detalhado</h3>
              <p>Receba um relatório abrangente com análises, insights e recomendações personalizadas.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="benefits-section">
        <div className="container">
          <div className="benefits-content">
            <h2 className="section-title">Benefícios</h2>
            <ul className="benefits-list">
              <li>Redução de até 70% no tempo de análise de documentos</li>
              <li>Maior precisão na extração de informações financeiras</li>
              <li>Identificação automatizada de inconsistências</li>
              <li>Sugestões personalizadas para melhorar elegibilidade ao crédito</li>
              <li>Interface intuitiva e segura para envio de documentos</li>
            </ul>
            
            <button 
              className="cta-button"
              onClick={handleClick}
            >
              {currentUser ? 'Iniciar Agora' : 'Entrar para Começar'}
            </button>
          </div>
        </div>
      </section>

      <footer className="home-footer">
        <div className="container">
          <p>© 2023 CredAnalyzer. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}

export default Home; 