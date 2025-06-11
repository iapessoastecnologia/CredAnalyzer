import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Processing.css';

function Processing() {
  const navigate = useNavigate();
  
  // Simulate processing time
  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/report');
    }, 3000); // 3 seconds
    
    return () => clearTimeout(timer);
  }, [navigate]);
  
  return (
    <div className="processing-container">
      {/* Decorative floating documents */}
      <div className="document"></div>
      <div className="document"></div>
      <div className="document"></div>
      <div className="document"></div>
      
      <div className="processing-content">
        <h1>Processando</h1>
        <p>Seus documentos estão sendo analisados...</p>
        <div className="loading-spinner"></div>
      </div>
    </div>
  );
}

export default Processing; 