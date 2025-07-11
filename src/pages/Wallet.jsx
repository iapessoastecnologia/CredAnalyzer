import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import '../styles/Wallet.css';
import { listarCartoes, definirCartaoPadrao, removerCartao, adicionarCartao, obterHistoricoPagamentos, cancelarAssinatura, getPlanoUsuario } from '../services/paymentService';
import { DEV_MODE } from '../services/paymentService';

function Wallet() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('cards');
  const [cards, setCards] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddCardForm, setShowAddCardForm] = useState(false);
  const [newCard, setNewCard] = useState({
    cardNumber: '',
    cardName: '',
    expiryDate: '',
    cvv: ''
  });
  const [userSubscription, setUserSubscription] = useState(null);
  const [saveMessage, setSaveMessage] = useState('');
  const [customerStripeId, setCustomerStripeId] = useState(null);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [lastPaymentMethod, setLastPaymentMethod] = useState(null);

  // Exibir mensagem de sucesso se vier da página de pagamento
  useEffect(() => {
    if (location.state?.paymentSuccess) {
      // Verificar se há informações sobre créditos anteriores
      if (location.state?.creditosAnteriores > 0) {
        setSaveMessage(`Plano atualizado com sucesso! ${location.state.creditosAnteriores} créditos anteriores + ${location.state.creditosTotais - location.state.creditosAnteriores} novos créditos = ${location.state.creditosTotais} créditos totais.`);
      } else {
        setSaveMessage('Pagamento realizado com sucesso!');
      }
      
      // Se houve erro no registro, exibir alerta
      if (location.state?.registroComErro) {
        console.log('[DEBUG WALLET] Pagamento foi processado, mas houve erro no registro');
        setSaveMessage('Pagamento realizado, mas houve um erro no registro. Por favor, contate o suporte caso não veja suas informações atualizadas.');
      }
      
      setTimeout(() => setSaveMessage(''), 5000);
      
      // Verificar se um cartão foi adicionado
      if (location.state?.cardAdded) {
        // Definir a aba ativa para cartões
        setActiveTab('cards');
        // Exibir mensagem de cartão adicionado
        setSaveMessage('Seu cartão foi adicionado como forma de pagamento principal.');
        setTimeout(() => setSaveMessage(''), 5000);
      }
    }
  }, [location]);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!currentUser) return;
      
      setLoading(true);
      try {
        // Buscar dados do usuário
        const userDoc = await getDoc(doc(db, "usuarios", currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          if (userData.stripeCustomerId) {
            setCustomerStripeId(userData.stripeCustomerId);
          }
          
          // Obter informações do plano do usuário
          try {
            const planResponse = await getPlanoUsuario(currentUser.uid);
            
            if (planResponse.success && planResponse.tem_plano) {
              setUserSubscription({
                plan: planResponse.plano.nome,
                reportsLeft: planResponse.plano.relatorios_restantes,
                endDate: new Date(planResponse.plano.data_fim),
                autoRenew: planResponse.plano.renovacao_automatica,
              });
            }
          } catch (err) {
            console.error("Erro ao obter plano:", err);
          }
        }

        // Buscar cartões se tiver customerStripeId
        if (customerStripeId) {
          try {
            const cardsResponse = await listarCartoes(customerStripeId);
            
            if (cardsResponse.success) {
              const cardsData = cardsResponse.cards.map(card => ({
                id: card.id,
                cardNumber: `**** **** **** ${card.last4}`,
                brand: card.brand,
                cardName: card.name || 'Cartão',
                expiryDate: `${card.exp_month}/${card.exp_year}`,
                isDefault: card.isDefault
              }));
              
              setCards(cardsData);
            }
          } catch (err) {
            console.error("Erro ao buscar cartões:", err);
          }
        }

        // Buscar histórico de pagamentos
        try {
          const historyResponse = await obterHistoricoPagamentos(currentUser.uid);
          
          if (historyResponse.success) {
            // Mapear os dados de pagamento
            let paymentsData = historyResponse.payments.map(payment => {
              // Determinar a data do pagamento
              let paymentDate;
              if (payment.created instanceof Date) {
                paymentDate = payment.created;
              } else if (typeof payment.created === 'number') {
                // Timestamp do Stripe (segundos desde epoch)
                paymentDate = new Date(payment.created * 1000);
              } else if (typeof payment.created === 'string') {
                // String ISO ou outra representação de data
                paymentDate = new Date(payment.created);
              } else {
                // Fallback para data atual
                paymentDate = new Date();
              }
              
              const paymentMethod = payment.payment_method_details?.type || payment.paymentMethod || 'unknown';
              
              // Armazenar o método de pagamento mais recente
              if (!lastPaymentMethod && payment) {
                setLastPaymentMethod(paymentMethod);
              }
              
              return {
                id: payment.id || payment.payment_id,
                amount: payment.amount,
                currency: payment.currency || 'brl',
                status: payment.status || 'succeeded',
                date: paymentDate,
                paymentMethod: paymentMethod,
                description: payment.description || `${payment.planName || 'Plano'} - Pagamento`,
                planName: payment.planName || (payment.description?.includes('Plano') ? 
                  payment.description.split(' - ')[0] : 'Assinatura')
              };
            });
            
            // Remover duplicatas baseadas no ID do pagamento
            const uniquePaymentIds = new Set();
            paymentsData = paymentsData.filter(payment => {
              if (uniquePaymentIds.has(payment.id)) {
                return false; // Já existe, filtrar
              }
              uniquePaymentIds.add(payment.id);
              return true; // Manter este pagamento
            });
            
            // Ordenar por data (mais recente primeiro)
            paymentsData.sort((a, b) => b.date - a.date);
            setPaymentHistory(paymentsData);
            
            // Definir o método de pagamento mais recente
            if (paymentsData.length > 0) {
              setLastPaymentMethod(paymentsData[0].paymentMethod);
            }
          } else if (historyResponse.error) {
            console.error("Erro ao buscar histórico de pagamentos:", historyResponse.error);
          }
        } catch (err) {
          console.error("Erro ao buscar histórico de pagamentos:", err);
        }
      } catch (err) {
        console.error("Erro ao buscar dados do usuário:", err);
        setError('Falha ao carregar dados da carteira.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, [currentUser, customerStripeId]);

  const handleCardInputChange = (e) => {
    const { name, value } = e.target;
    setNewCard({
      ...newCard,
      [name]: value
    });
  };

  const handleAddCard = async (e) => {
    e.preventDefault();
    
    if (!customerStripeId) {
      setError('Identificador do cliente não encontrado');
      return;
    }
    
    try {
      setLoading(true);
      
      // Normalmente, você usaria Stripe Elements para gerenciar este processo
      // de forma segura, mas para este exemplo, estamos simulando
      alert('Em um ambiente real, você usaria Stripe Elements para coletar dados do cartão de forma segura');
      
      // Dados que seriam gerados pelo Stripe após processamento do cartão
      const cardData = {
        customer_id: customerStripeId,
        payment_method_id: `pm_simulated_${Date.now()}`,
        set_default: cards.length === 0
      };
      
      const response = await adicionarCartao(cardData);
      
      if (response.success) {
        setSaveMessage('Cartão adicionado com sucesso!');
        setTimeout(() => setSaveMessage(''), 3000);
        
        setNewCard({
          cardNumber: '',
          cardName: '',
          expiryDate: '',
          cvv: ''
        });
        
        setShowAddCardForm(false);
        
        // Recarregar cartões
        const cardsResponse = await listarCartoes(customerStripeId);
        
        if (cardsResponse.success) {
          const cardsData = cardsResponse.cards.map(card => ({
            id: card.id,
            cardNumber: `**** **** **** ${card.last4}`,
            brand: card.brand,
            cardName: card.name || 'Cartão',
            expiryDate: `${card.exp_month}/${card.exp_year}`,
            isDefault: card.isDefault
          }));
          
          setCards(cardsData);
        }
      } else {
        setError(response.error || 'Erro ao adicionar cartão');
      }
    } catch (err) {
      console.error("Erro ao adicionar cartão:", err);
      setError('Falha ao adicionar cartão.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefaultCard = async (cardId) => {
    if (!customerStripeId) return;
    
    try {
      setLoading(true);
      
      const response = await definirCartaoPadrao(customerStripeId, cardId);
      
      if (response.success) {
        setCards(cards.map(card => ({
          ...card,
          isDefault: card.id === cardId
        })));
        
        setSaveMessage('Cartão padrão atualizado!');
        setTimeout(() => setSaveMessage(''), 3000);
      } else {
        setError(response.error || 'Erro ao definir cartão padrão');
      }
    } catch (err) {
      console.error("Erro ao definir cartão padrão:", err);
      setError('Falha ao definir cartão padrão.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveCard = async (cardId) => {
    if (!customerStripeId) return;
    
    try {
      setLoading(true);
      
      if (cards.length === 1) {
        setError('Você precisa ter pelo menos um cartão cadastrado.');
        setLoading(false);
        return;
      }
      
      const response = await removerCartao(customerStripeId, cardId);
      
      if (response.success) {
        const updatedCards = cards.filter(card => card.id !== cardId);
        setCards(updatedCards);
        
        setSaveMessage('Cartão removido com sucesso!');
        setTimeout(() => setSaveMessage(''), 3000);
      } else {
        setError(response.error || 'Erro ao remover cartão');
      }
    } catch (err) {
      console.error("Erro ao remover cartão:", err);
      setError('Falha ao remover cartão.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAutoRenew = async () => {
    if (!userSubscription || !currentUser) return;
    
    try {
      // Verificar se o último pagamento foi via PIX e está tentando ativar renovação automática
      if (!userSubscription.autoRenew && lastPaymentMethod === 'pix') {
        // Verificar se o usuário tem cartões cadastrados
        if (cards.length === 0) {
          setShowRenewModal(true);
          return;
        }
      }
      
      setLoading(true);
      
      // Obter o estado atual
      const currentAutoRenewState = userSubscription.autoRenew;
      
      // Chamar API com base no estado atual (para inverter)
      let response;
      
      if (currentAutoRenewState) {
        // Desativar a renovação automática
        response = await cancelarAssinatura(currentUser.uid);
      } else {
        // Ativar a renovação automática (Simularemos uma API)
        response = { 
          success: true,
          message: 'Renovação automática ativada com sucesso'
        };
        
        // Em produção seria algo como:
        // response = await reativarAssinatura(currentUser.uid);
      }
      
      if (response.success) {
        // Atualizar o estado local
        setUserSubscription({
          ...userSubscription,
          autoRenew: !currentAutoRenewState
        });
        
        // Atualizar os dados do usuário no Firestore com o novo estado
        const userDocRef = doc(db, 'usuarios', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.subscription) {
            await updateDoc(userDocRef, {
              'subscription.autoRenew': !currentAutoRenewState
            });
          }
        }
        
        // Mostrar mensagem apropriada
        const message = currentAutoRenewState 
          ? 'Renovação automática desativada!' 
          : 'Renovação automática ativada!';
          
        setSaveMessage(message);
        setTimeout(() => setSaveMessage(''), 3000);
      } else {
        setError(response.error || 'Erro ao alterar renovação automática');
      }
    } catch (err) {
      console.error("Erro ao alterar renovação automática:", err);
      setError('Falha ao alterar renovação automática.');
    } finally {
      setLoading(false);
    }
  };

  const detectCardBrand = (cardNumber) => {
    if (cardNumber.startsWith('4')) return 'Visa';
    if (cardNumber.startsWith('5')) return 'Mastercard';
    if (cardNumber.startsWith('3')) return 'American Express';
    if (cardNumber.startsWith('6')) return 'Discover';
    
    return 'Outro';
  };

  const formatCurrency = (value) => {
    if (value === undefined || value === null) return 'R$ 0,00';
    
    try {
      // Converter para número se for string
      const numValue = typeof value === 'string' ? parseFloat(value) : value;
      
      // Se o valor parece estar em centavos (maior que 1000), converter para reais
      const finalValue = numValue > 1000 ? numValue / 100 : numValue;
      
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(finalValue);
    } catch (error) {
      console.error('Erro ao formatar valor:', error);
      return `R$ ${value}`;
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    
    try {
      const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
      return new Date(date).toLocaleDateString('pt-BR', options);
    } catch (error) {
      console.error('Erro ao formatar data:', error);
      return 'Data inválida';
    }
  };

  return (
    <div className="wallet-container">
      <div className="wallet-sidebar">
        <h3>Carteira</h3>
        <ul>
          <li 
            className={activeTab === 'cards' ? 'active' : ''}
            onClick={() => setActiveTab('cards')}
          >
            Meus Cartões
          </li>
          <li 
            className={activeTab === 'payments' ? 'active' : ''}
            onClick={() => setActiveTab('payments')}
          >
            Histórico de Pagamentos
          </li>
          <li 
            className={activeTab === 'subscription' ? 'active' : ''}
            onClick={() => setActiveTab('subscription')}
          >
            Minha Assinatura
          </li>
        </ul>
        <button onClick={() => navigate('/profile')} className="back-button">
          Voltar ao Perfil
        </button>
      </div>

      <div className="wallet-content">
        {saveMessage && <div className="success-message">{saveMessage}</div>}
        {error && <div className="error-message">{error}</div>}

        {loading ? (
          <div className="loading-container">
            <p>Carregando...</p>
          </div>
        ) : (
          <>
            {activeTab === 'cards' && (
              <div className="cards-section">
                <div className="section-header">
                  <h2>Meus Cartões</h2>
                  <button 
                    className="add-card-button"
                    onClick={() => setShowAddCardForm(!showAddCardForm)}
                  >
                    {showAddCardForm ? 'Cancelar' : '+ Adicionar Cartão'}
                  </button>
                </div>

                {showAddCardForm && (
                  <form className="add-card-form" onSubmit={handleAddCard}>
                    <div className="form-group">
                      <label htmlFor="cardNumber">Número do Cartão</label>
                      <input
                        type="text"
                        id="cardNumber"
                        name="cardNumber"
                        value={newCard.cardNumber}
                        onChange={handleCardInputChange}
                        placeholder="1234 5678 9012 3456"
                        required
                        maxLength="16"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="cardName">Nome no Cartão</label>
                      <input
                        type="text"
                        id="cardName"
                        name="cardName"
                        value={newCard.cardName}
                        onChange={handleCardInputChange}
                        placeholder="Nome como está no cartão"
                        required
                      />
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor="expiryDate">Data de Expiração</label>
                        <input
                          type="text"
                          id="expiryDate"
                          name="expiryDate"
                          value={newCard.expiryDate}
                          onChange={handleCardInputChange}
                          placeholder="MM/AA"
                          required
                          maxLength="5"
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="cvv">CVV</label>
                        <input
                          type="text"
                          id="cvv"
                          name="cvv"
                          value={newCard.cvv}
                          onChange={handleCardInputChange}
                          placeholder="123"
                          required
                          maxLength="4"
                        />
                      </div>
                    </div>

                    <div className="form-actions">
                      <button type="submit" className="save-card-button">
                        Salvar Cartão
                      </button>
                    </div>
                  </form>
                )}

                {cards.length === 0 && !showAddCardForm ? (
                  <div className="empty-state">
                    <p>Você ainda não possui cartões cadastrados.</p>
                    <button 
                      className="add-card-button empty"
                      onClick={() => setShowAddCardForm(true)}
                    >
                      Adicionar Cartão
                    </button>
                  </div>
                ) : (
                  <div className="cards-grid">
                    {cards.map((card) => (
                      <div key={card.id} className={`card-item ${card.isDefault ? 'default' : ''}`}>
                        <div className="card-header">
                          <h3>{getBrandDisplay(card.brand)}</h3>
                          {card.isDefault && <span className="default-badge">Padrão</span>}
                        </div>
                        <div className="card-number">
                          {card.cardNumber}
                        </div>
                        <div className="card-info">
                          <p className="card-name">{card.cardName}</p>
                          <p className="card-expiry">Validade: {card.expiryDate}</p>
                        </div>
                        <div className="card-actions">
                          {!card.isDefault && (
                            <button 
                              className="set-default-button"
                              onClick={() => handleSetDefaultCard(card.id)}
                            >
                              Definir como padrão
                            </button>
                          )}
                          <button 
                            className="remove-card-button"
                            onClick={() => handleRemoveCard(card.id)}
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'payments' && (
              <div className="payments-section">
                <h2>Histórico de Pagamentos</h2>
                
                {paymentHistory.length === 0 ? (
                  <div className="empty-state">
                    <p>Você ainda não realizou nenhum pagamento.</p>
                    <button 
                      className="empty-button"
                      onClick={() => navigate('/payment')}
                    >
                      Assinar um Plano
                    </button>
                  </div>
                ) : (
                  <div className="payment-table-container">
                    <table className="payment-table">
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Plano</th>
                          <th>Valor</th>
                          <th>Método</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentHistory.map((payment) => (
                          <tr key={payment.id}>
                            <td>{formatDate(payment.date)}</td>
                            <td>{payment.planName}</td>
                            <td>{formatCurrency(payment.amount)}</td>
                            <td>
                              <div className="payment-method-profile-screen">
                                {getPaymentMethodDisplay(payment.paymentMethod)}
                              </div>
                            </td>
                            <td>
                              <div className={`payment-status ${getStatusClass(payment.status)}`}>
                                {getStatusDisplay(payment.status)}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'subscription' && (
              <div className="subscription-section">
                <h2>Minha Assinatura</h2>
                
                {!userSubscription ? (
                  <div className="empty-state">
                    <p>Você ainda não possui uma assinatura ativa.</p>
                    <p className="empty-description">
                      Escolha um dos nossos planos para começar a gerar relatórios personalizados.
                    </p>
                    <button 
                      className="empty-button"
                      onClick={() => navigate('/payment')}
                    >
                      Assinar um Plano
                    </button>
                  </div>
                ) : (
                  <div className="subscription-details">
                    <div className="subscription-card">
                      <div className="subscription-header">
                        <h3>{userSubscription.plan}</h3>
                      </div>
                      
                      <div className="subscription-info">
                        <div className="info-item">
                          <span className="info-label">Relatórios Restantes</span>
                          <span className="info-value">{userSubscription.reportsLeft}</span>
                        </div>
                        <div className="info-item">
                          <span className="info-label">Validade</span>
                          <span className="info-value">{formatDate(userSubscription.endDate)}</span>
                        </div>
                        <div className="info-item">
                          <span className="info-label">Renovação Automática</span>
                          <div className="toggle-container">
                            <label className="toggle">
                              <input 
                                type="checkbox" 
                                checked={userSubscription.autoRenew}
                                onChange={handleToggleAutoRenew}
                                disabled={loading}
                              />
                              <span className="slider"></span>
                            </label>
                            <span className="toggle-status">
                              {userSubscription.autoRenew ? 'Ativada' : 'Desativada'}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="subscription-actions">
                        <button 
                          className="change-plan-button"
                          onClick={() => navigate('/payment')}
                        >
                          Alterar Plano
                        </button>
                        <p className="credits-note">
                          <small>* Ao alterar seu plano, seus créditos restantes serão somados aos novos créditos.</small>
                        </p>
                      </div>
                    </div>
                    
                    <div className="subscription-info-box">
                      <h4>Informações sobre sua assinatura</h4>
                      <p>
                        Seu plano atual lhe dá direito a geração de relatórios completos de acordo
                        com o limite do plano contratado. A cobrança é realizada mensalmente
                        utilizando o cartão de crédito definido como padrão.
                      </p>
                      <p>
                        Caso deseje cancelar a renovação automática, você pode desativar a opção
                        acima. Nesse caso, sua assinatura continuará válida até o final do período
                        atual, mas não será renovada automaticamente.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal para adicionar cartão para renovação automática */}
      {showRenewModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Cartão Necessário</h3>
            <p>Para ativar a renovação automática, você precisa adicionar um cartão de crédito, pois seu último pagamento foi feito via PIX.</p>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setShowRenewModal(false)}>
                Cancelar
              </button>
              <button 
                className="primary-button"
                onClick={() => {
                  setShowRenewModal(false);
                  setActiveTab('cards');
                  setShowAddCardForm(true);
                }}
              >
                Adicionar Cartão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Funções auxiliares para exibição
function getBrandDisplay(brand) {
  switch (brand?.toLowerCase()) {
    case 'visa': return 'Visa';
    case 'mastercard': return 'Mastercard';
    case 'amex': return 'American Express';
    case 'discover': return 'Discover';
    default: return brand || 'Cartão';
  }
}

function getPaymentMethodDisplay(method) {
  switch (method?.toLowerCase()) {
    case 'card':
    case 'credit':
      return 'Cartão de Crédito';
    case 'pix':
      return 'PIX';
    case 'boleto':
      return 'Boleto';
    default:
      return method || 'Desconhecido';
  }
}

function getStatusClass(status) {
  switch (status?.toLowerCase()) {
    case 'succeeded':
    case 'completed':
    case 'paid':
      return 'status-success';
    case 'processing':
    case 'awaiting_payment':
      return 'status-pending';
    case 'failed':
    case 'canceled':
      return 'status-failed';
    default:
      return 'status-unknown';
  }
}

function getStatusDisplay(status) {
  switch (status?.toLowerCase()) {
    case 'succeeded':
    case 'completed':
    case 'paid':
      return 'Concluído';
    case 'processing':
      return 'Processando';
    case 'awaiting_payment':
      return 'Aguardando Pagamento';
    case 'failed':
      return 'Falhou';
    case 'canceled':
      return 'Cancelado';
    default:
      return status || 'Desconhecido';
  }
}

export default Wallet; 