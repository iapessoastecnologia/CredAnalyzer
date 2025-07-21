import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
// Importações corretas para React 19 e ReactMarkdown 10
import { generatePdfFromHtml } from '../utils/reportUtils';
import { maskPhone } from '../utils/maskUtils';
import '../styles/Profile.css';

// Função utilitária para garantir que o conteúdo markdown é uma string válida
const formatMarkdownContent = (content) => {
  if (!content) return '';
  return typeof content === 'string' ? content : String(content);
};

function Profile() {
  const { currentUser, logout, updateUserData } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('relatorios');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userData, setUserData] = useState({});
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [formData, setFormData] = useState({});
  const [saveMessage, setSaveMessage] = useState('');
  const [shouldFetchReports, setShouldFetchReports] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!currentUser) return;
      
      try {
        const userDoc = await getDoc(doc(db, "usuarios", currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserData(data);
          setFormData({
            nome: data.nome || '',
            email: data.email || '',
            telefone: data.telefone || '',
          });
        }
      } catch (err) {
        console.error("Erro ao buscar dados do usuário:", err);
        setError('Falha ao carregar dados do usuário.');
      }
    };
    
    fetchUserData();
  }, [currentUser]);

  useEffect(() => {
    const fetchReports = async () => {
      if (!currentUser || !shouldFetchReports) return;
      
      setLoading(true);
      try {
        console.log("Filtrando relatórios entre:", startDate, "e", endDate);
        
        // Converter para formato YYYY-MM-DD para comparação
        const startDateStr = startDate;
        const endDateStr = endDate;
        
        const reportsRef = collection(db, 'relatorios');
        
        // Buscar todos os relatórios do usuário
        const q = query(
          reportsRef,
          where('usuarioId', '==', currentUser.uid)
        );
        
        const querySnapshot = await getDocs(q);
        const reportsList = [];
        
        querySnapshot.forEach((doc) => {
          const reportData = doc.data();
          
          if (reportData.timestamp) {
            try {
              // Obter a data do relatório no formato YYYY-MM-DD
              let date;
              
              if (typeof reportData.timestamp.toDate === 'function') {
                // Timestamp do Firestore
                date = reportData.timestamp.toDate();
              } else if (reportData.timestamp instanceof Date) {
                date = reportData.timestamp;
              } else {
                date = new Date(reportData.timestamp);
              }
              
              // Extrair apenas ano-mês-dia como string no formato YYYY-MM-DD
              // Isso remove qualquer problema de horário ou fuso
              const reportYear = date.getFullYear();
              const reportMonth = String(date.getMonth() + 1).padStart(2, '0');
              const reportDay = String(date.getDate()).padStart(2, '0');
              const reportDateStr = `${reportYear}-${reportMonth}-${reportDay}`;
              
              console.log(`Relatório ${doc.id}: Data = ${reportDateStr}`);
              
              // Comparar as strings de data
              const isInRange = reportDateStr >= startDateStr && reportDateStr <= endDateStr;
              console.log(`É maior ou igual a ${startDateStr}? ${reportDateStr >= startDateStr}`);
              console.log(`É menor ou igual a ${endDateStr}? ${reportDateStr <= endDateStr}`);
              
              if (isInRange) {
                console.log(`Relatório ${doc.id} incluído no filtro`);
                reportsList.push({
                  id: doc.id,
                  ...reportData,
                  dateFormatted: date.toLocaleDateString()
                });
              } else {
                console.log(`Relatório ${doc.id} excluído do filtro`);
              }
            } catch (error) {
              console.error(`Erro ao processar data do relatório ${doc.id}:`, error);
            }
          }
        });
        
        // Ordenar por data, do mais recente para o mais antigo
        reportsList.sort((a, b) => {
          const dateA = a.timestamp?.toDate?.() || new Date(a.timestamp || 0);
          const dateB = b.timestamp?.toDate?.() || new Date(b.timestamp || 0);
          return dateB - dateA;
        });
        
        console.log(`Total de relatórios encontrados: ${reportsList.length}`);
        setReports(reportsList);
        setShouldFetchReports(false);
      } catch (err) {
        console.error("Erro ao buscar relatórios:", err);
        setError('Falha ao carregar relatórios.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchReports();
  }, [currentUser, shouldFetchReports, startDate, endDate]);

  const handleViewReport = (report) => {
    setSelectedReport(report);
  };

  const handleCloseReport = () => {
    setSelectedReport(null);
  };

  const handleDownloadPDF = () => {
    if (!selectedReport) return;
    
    const reportElement = document.getElementById('report-content');
    if (reportElement) {
      generatePdfFromHtml(reportElement.innerHTML);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Aplicar máscara para telefone
    if (name === 'telefone') {
      setFormData({
        ...formData,
        [name]: maskPhone(value)
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const handleSaveSettings = async () => {
    if (!currentUser) return;
    
    try {
      await updateUserData(currentUser.uid, formData);
      setSaveMessage('Dados atualizados com sucesso!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      console.error("Erro ao salvar configurações:", err);
      setError('Falha ao salvar configurações.');
    }
  };

  const handleConfirmDeleteAccount = async () => {
    if (!currentUser) return;
    
    try {
      // Atualizar o status da conta para inativo
      await updateDoc(doc(db, "usuarios", currentUser.uid), {
        status: 'inativo',
        inativadoEm: new Date()
      });
      
      // Fazer logout após inativar a conta
      await logout();
      navigate('/login');
    } catch (err) {
      console.error("Erro ao desativar conta:", err);
      setError('Falha ao desativar conta.');
    }
  };

  const handleApplyFilter = () => {
    if (loading) return; // Evitar múltiplos cliques durante o carregamento
    setShouldFetchReports(true);
  };

  return (
    <div className="profile-container">
      <div className="profile-sidebar">
        <h3>Menu</h3>
        <ul>
          <li 
            className={activeTab === 'relatorios' ? 'active' : ''}
            onClick={() => setActiveTab('relatorios')}
          >
            Relatórios
          </li>
          <li 
            className={activeTab === 'configuracoes' ? 'active' : ''}
            onClick={() => setActiveTab('configuracoes')}
          >
            Configurações
          </li>
          <li 
            className="wallet-link"
            onClick={() => navigate('/wallet')}
          >
            Carteira
          </li>
        </ul>
        <button onClick={() => navigate('/')} className="back-button">
          Voltar ao Início
        </button>
      </div>

      <div className="profile-content">
        {error && <div className="error-message">{error}</div>}

        {/* Visualização de relatório em tela cheia */}
        {selectedReport && (
          <div className="full-screen-report">
            <div className="report-header">
              <h2>{selectedReport.planejamentoInicial?.nomeEmpresa || 'Relatório'}</h2>
              <div className="report-actions">
                <button onClick={handleDownloadPDF} className="download-button">
                  Baixar PDF
                </button>
                <button onClick={handleCloseReport} className="close-button">
                  Fechar
                </button>
              </div>
            </div>
            <div className="report-full-content markdown-container" id="report-content">
              {selectedReport.conteudoRelatorio ? (
                <ReactMarkdown rehypePlugins={[]} remarkPlugins={[[remarkGfm, {singleTilde: false}]]}>
                  {formatMarkdownContent(selectedReport.conteudoRelatorio)}
                </ReactMarkdown>
              ) : (
                <p>Conteúdo do relatório não disponível.</p>
              )}
            </div>
          </div>
        )}

        {!selectedReport && activeTab === 'relatorios' && (
          <div className="reports-section">
            <h2>Meus Relatórios</h2>
            
            <div className="date-filter-container">
              <div className="date-filter">
                <div>
                  <label htmlFor="startDate">Data Inicial:</label>
                  <input
                    type="date"
                    id="startDate"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="endDate">Data Final:</label>
                  <input
                    type="date"
                    id="endDate"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
                <div className="filter-button-container">
                  <button 
                    className="filter-button"
                    onClick={handleApplyFilter}
                    disabled={loading}
                  >
                    {loading ? 'Filtrando...' : 'Aplicar Filtro'}
                  </button>
                </div>
              </div>
              
              <div className="reports-counter">
                <div className="counter-icon">
                  <span className="counter-number">{reports.length}</span>
                </div>
                <span className="counter-label">
                  {reports.length === 1 ? 'Relatório encontrado' : 'Relatórios encontrados'}
                </span>
              </div>
            </div>

            {loading ? (
              <p>Carregando relatórios...</p>
            ) : reports.length === 0 ? (
              <p>Nenhum relatório encontrado para o período selecionado.</p>
            ) : (
              <div className="reports-grid">
                {reports.map((report) => (
                  <div key={report.id} className="report-card" onClick={() => handleViewReport(report)}>
                    <div className="report-card-preview">
                      {report.conteudoRelatorio ? (
                        <div className="markdown-container">
                          <ReactMarkdown 
                            rehypePlugins={[]} 
                            remarkPlugins={[[remarkGfm, {singleTilde: false}]]}
                          >
                                                      {(() => {
                              const content = formatMarkdownContent(report.conteudoRelatorio);
                              return content.length > 150 ? content.substring(0, 150) + '...' : content;
                            })()}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p>Conteúdo do relatório não disponível.</p>
                      )}
                    </div>
                    <div className="report-card-footer">
                      <p>
                        {report.planejamentoInicial?.nomeEmpresa || report.planejamentoInicial?.segmentoEmpresa || 'Empresa'} - {' '}
                        {report.timestamp?.toDate().toLocaleDateString() || new Date().toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!selectedReport && activeTab === 'configuracoes' && (
          <div className="settings-section">
            <h2>Configurações da Conta</h2>
            
            {saveMessage && <div className="success-message">{saveMessage}</div>}
            
            <div className="form-group">
              <label htmlFor="nome">Nome:</label>
              <input
                type="text"
                id="nome"
                name="nome"
                value={formData.nome || ''}
                onChange={handleInputChange}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="email">Email:</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email || ''}
                onChange={handleInputChange}
                disabled={true}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="telefone">Telefone:</label>
              <input
                type="text"
                id="telefone"
                name="telefone"
                value={formData.telefone || ''}
                onChange={handleInputChange}
                placeholder="(XX) XXXXX-XXXX"
              />
            </div>
            
            <div className="settings-actions">
              <button onClick={handleSaveSettings} className="save-button">
                Salvar Alterações
              </button>
              
              <button 
                onClick={() => setShowDeleteConfirm(true)} 
                className="delete-button"
              >
                Excluir Conta
              </button>
            </div>

            {showDeleteConfirm && (
              <div className="confirm-delete">
                <div className="confirm-delete-content">
                  <h3>Confirmação</h3>
                  <p>Tem certeza que deseja excluir sua conta? Esta ação não poderá ser desfeita.</p>
                  <div className="confirm-actions">
                    <button onClick={handleConfirmDeleteAccount} className="confirm-button">
                      Sim, excluir minha conta
                    </button>
                    <button onClick={() => setShowDeleteConfirm(false)} className="cancel-button">
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Profile; 