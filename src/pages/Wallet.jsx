import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import '../styles/Wallet.css';

function Wallet() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
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

  useEffect(() => {
    const fetchUserData = async () => {
      if (!currentUser) return;
      
      setLoading(true);
      try {
        // Buscar dados do usuário
        const userDoc = await getDoc(doc(db, "usuarios", currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          // Verificar se o usuário tem assinatura
          if (userData.subscription) {
            setUserSubscription({
              plan: userData.subscription.planName,
              reportsLeft: userData.subscription.reportsLeft,
              endDate: userData.subscription.endDate?.toDate ? 
                userData.subscription.endDate.toDate() : 
                new Date(userData.subscription.endDate),
              autoRenew: userData.subscription.autoRenew || false,
            });
          }
        }

        // Simular busca de cartões
        const cardsQuery = query(
          collection(db, 'cartoes'),
          where('usuarioId', '==', currentUser.uid)
        );
        const cardsSnapshot = await getDocs(cardsQuery);
        const cardsData = [];
        
        cardsSnapshot.forEach((doc) => {
          cardsData.push({
            id: doc.id,
            ...doc.data(),
            cardNumber: `**** **** **** ${doc.data().lastFourDigits || '1234'}`,
            isDefault: doc.data().isDefault || false
          });
        });
        
        setCards(cardsData);

        // Buscar histórico de pagamentos
        const paymentsQuery = query(
          collection(db, 'pagamentos'),
          where('usuarioId', '==', currentUser.uid)
        );
        const paymentsSnapshot = await getDocs(paymentsQuery);
        const paymentsData = [];
        
        paymentsSnapshot.forEach((doc) => {
          const paymentData = doc.data();
          paymentsData.push({
            id: doc.id,
            ...paymentData,
            date: paymentData.timestamp?.toDate ? 
              paymentData.timestamp.toDate() : 
              new Date(paymentData.timestamp || Date.now()),
          });
        });
        
        paymentsData.sort((a, b) => b.date - a.date);
        
        setPaymentHistory(paymentsData);
      } catch (err) {
        console.error("Erro ao buscar dados do usuário:", err);
        setError('Falha ao carregar dados da carteira.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, [currentUser]);

  const handleCardInputChange = (e) => {
    const { name, value } = e.target;
    setNewCard({
      ...newCard,
      [name]: value
    });
  };

  const handleAddCard = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      const lastFourDigits = newCard.cardNumber.slice(-4);
      
      await addDoc(collection(db, 'cartoes'), {
        usuarioId: currentUser.uid,
        cardName: newCard.cardName,
        lastFourDigits,
        brand: detectCardBrand(newCard.cardNumber),
        expiryDate: newCard.expiryDate,
        isDefault: cards.length === 0,
        createdAt: new Date()
      });
      
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
      const cardsQuery = query(
        collection(db, 'cartoes'),
        where('usuarioId', '==', currentUser.uid)
      );
      const cardsSnapshot = await getDocs(cardsQuery);
      const cardsData = [];
      
      cardsSnapshot.forEach((doc) => {
        cardsData.push({
          id: doc.id,
          ...doc.data(),
          cardNumber: `**** **** **** ${doc.data().lastFourDigits || '1234'}`,
        });
      });
      
      setCards(cardsData);
    } catch (err) {
      console.error("Erro ao adicionar cartão:", err);
      setError('Falha ao adicionar cartão.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefaultCard = async (cardId) => {
    try {
      setLoading(true);
      
      for (const card of cards) {
        await updateDoc(doc(db, 'cartoes', card.id), {
          isDefault: card.id === cardId
        });
      }
      
      setCards(cards.map(card => ({
        ...card,
        isDefault: card.id === cardId
      })));
      
      setSaveMessage('Cartão padrão atualizado!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      console.error("Erro ao definir cartão padrão:", err);
      setError('Falha ao definir cartão padrão.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveCard = async (cardId) => {
    try {
      setLoading(true);
      
      if (cards.length === 1) {
        setError('Você precisa ter pelo menos um cartão cadastrado.');
        setLoading(false);
        return;
      }
      
      const isDefault = cards.find(card => card.id === cardId)?.isDefault;
      
      await deleteDoc(doc(db, 'cartoes', cardId));
      
      if (isDefault) {
        const nextCard = cards.find(card => card.id !== cardId);
        if (nextCard) {
          await updateDoc(doc(db, 'cartoes', nextCard.id), {
            isDefault: true
          });
        }
      }
      
      const updatedCards = cards.filter(card => card.id !== cardId);
      if (isDefault && updatedCards.length > 0) {
        updatedCards[0].isDefault = true;
      }
      
      setCards(updatedCards);
      
      setSaveMessage('Cartão removido com sucesso!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      console.error("Erro ao remover cartão:", err);
      setError('Falha ao remover cartão.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAutoRenew = async () => {
    if (!userSubscription) return;
    
    try {
      setLoading(true);
      
      const userDoc = doc(db, "usuarios", currentUser.uid);
      await updateDoc(userDoc, {
        "subscription.autoRenew": !userSubscription.autoRenew
      });
      
      setUserSubscription({
        ...userSubscription,
        autoRenew: !userSubscription.autoRenew
      });
      
      setSaveMessage(`Renovação automática ${!userSubscription.autoRenew ? 'ativada' : 'desativada'}!`);
      setTimeout(() => setSaveMessage(''), 3000);
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
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(value);
  };

  const formatDate = (date) => {
    return new Intl.DateTimeFormat('pt-BR').format(date);
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
                    {showAddCardForm ? 'Cancelar' : 'Adicionar Cartão'}
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
                          <h3>{card.brand}</h3>
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
                  <div className="payments-table-container">
                    <table className="payments-table">
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
                            <td>{payment.paymentMethod}</td>
                            <td>
                              <span className={`status-badge ${payment.status}`}>
                                {payment.status === 'completed' ? 'Concluído' : 
                                 payment.status === 'pending' ? 'Pendente' : 
                                 payment.status === 'failed' ? 'Falhou' : payment.status}
                              </span>
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
    </div>
  );
}

export default Wallet; 