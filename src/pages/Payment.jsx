import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Elements } from '@stripe/react-stripe-js';
import stripePromise from '../stripe/stripeConfig';
import CheckoutForm from '../components/CheckoutForm';
import PixCheckout from '../components/PixCheckout';
import '../styles/Payment.css';
import '../styles/CheckoutForm.css';
import { getPlanos, criarCheckoutPagamento, criarCheckoutAssinatura, criarPagamentoPix, registrarPagamento } from '../services/paymentService';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

function Payment() {
  const auth = useAuth();
  const currentUser = auth?.currentUser;
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('credit');
  const [paymentStatus, setPaymentStatus] = useState('pending'); // pending, processing, success, error
  const [paymentError, setPaymentError] = useState(null);
  const [showCardAddedModal, setShowCardAddedModal] = useState(false);
  const [plans, setPlans] = useState([
    {
      id: 'basic',
      nome: 'Plano Básico',
      relatorios: 20,
      preco: 35,
      desconto: 0
    },
    {
      id: 'standard',
      nome: 'Plano Padrão',
      relatorios: 40,
      preco: 55,
      desconto: 21
    },
    {
      id: 'premium',
      nome: 'Plano Premium',
      relatorios: 70,
      preco: 75,
      desconto: 39
    }
  ]);
  
  // Flag para modo de desenvolvimento
  const isDev = import.meta.env.VITE_DEV_MODE === 'true';
  
  // Log para depuração
  useEffect(() => {
    console.log('[DEBUG PAYMENT] Componente Payment montado, currentUser:', currentUser ? 'autenticado' : 'não autenticado');
  }, [currentUser]);

  // Carregar planos
  useEffect(() => {
    const fetchPlanos = async () => {
      try {
        const response = await getPlanos();
        if (response.success && response.planos && response.planos.length > 0) {
          setPlans(response.planos);
        }
      } catch (error) {
        console.error('Erro ao carregar planos:', error);
      }
    };

    fetchPlanos();
  }, []);

  const handlePlanSelect = (plan) => {
    setSelectedPlan(plan);
    setPaymentStatus('pending');
    setPaymentError(null);
  };

  const handlePaymentMethodChange = (method) => {
    setPaymentMethod(method);
    setPaymentStatus('pending');
    setPaymentError(null);
  };

  const handlePaymentSuccess = async (paymentData) => {
    try {
      console.log('[DEBUG PAYMENT] Processando pagamento:', paymentData);
      setPaymentStatus('processing');
      
      // Se for PIX e status for awaiting_payment ou não for succeeded, não finalizar o processo ainda
      if (paymentMethod === 'pix' && 
         (paymentData.status === 'awaiting_payment' || paymentData.status !== 'succeeded')) {
        console.log('[DEBUG PAYMENT] Pagamento PIX aguardando confirmação. Aguarde...');
        return; // Não prosseguir até que o PIX seja confirmado
      }
      
      // Verificar se este pagamento já foi processado anteriormente
      // Usar localStorage para rastrear pagamentos processados na sessão atual
      const processedPaymentsKey = `processed_payments_${currentUser.uid}`;
      const processedPayments = JSON.parse(localStorage.getItem(processedPaymentsKey) || '[]');
      const paymentId = paymentData.paymentId || paymentData.id || `payment_${Date.now()}`;
      
      if (processedPayments.includes(paymentId)) {
        console.log('[DEBUG PAYMENT] Este pagamento já foi processado anteriormente:', paymentId);
        
        // Mesmo assim, atualizar a UI para mostrar sucesso
        setPaymentStatus('success');
        
        // Redirecionar após um pequeno delay
        setTimeout(() => {
          navigate('/wallet', { 
            state: { paymentSuccess: true, plan: selectedPlan } 
          });
        }, 1000);
        
        return;
      }
      
      // Verificar se o usuário já possui um plano e créditos restantes
      let creditosExistentes = 0;
      let planoAnterior = null;
      
      try {
        const userDoc = await getDoc(doc(db, "usuarios", currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // Verificar se o usuário já tem créditos
          if (userData.creditosRestantes && userData.creditosRestantes > 0) {
            creditosExistentes = userData.creditosRestantes;
            console.log('[DEBUG PAYMENT] Usuário possui créditos existentes:', creditosExistentes);
          }
          
          // Verificar se já tem plano para registrar o plano anterior
          if (userData.subscription && userData.subscription.planName) {
            planoAnterior = userData.subscription.planName;
            console.log('[DEBUG PAYMENT] Plano anterior do usuário:', planoAnterior);
          }
        }
      } catch (error) {
        console.error('[DEBUG PAYMENT] Erro ao verificar créditos existentes:', error);
        // Continuar mesmo com erro - não é crítico
      }
      
      // Atualizar o status da assinatura no Firebase
      const subscriptionData = {
        planId: selectedPlan.id,
        planName: selectedPlan.nome,
        reportsLeft: selectedPlan.relatorios + creditosExistentes, // Somar os créditos existentes
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
        autoRenew: paymentMethod === 'credit', // Renovação automática só para cartão
        telefone: currentUser?.phoneNumber || '',
        stripeCustomerId: null, // Será atualizado se disponível
        stripeSubscriptionId: null, // Será atualizado se for assinatura
        previousPlan: planoAnterior // Registrar o plano anterior
      };
      
      // Verificar se o usuário possui um ID de cliente no Stripe
      let stripeCustomerId = null;
      try {
        const userDoc = await getDoc(doc(db, "usuarios", currentUser.uid));
        if (userDoc.exists() && userDoc.data().stripeCustomerId) {
          stripeCustomerId = userDoc.data().stripeCustomerId;
          subscriptionData.stripeCustomerId = stripeCustomerId;
        }
      } catch (error) {
        console.error('[DEBUG PAYMENT] Erro ao buscar dados do usuário:', error);
        // Continuar mesmo com erro - não é crítico
      }
      
      // Se for uma assinatura e o paymentData contiver um subscription_id
      if (paymentMethod === 'credit' && paymentData.subscription_id) {
        subscriptionData.stripeSubscriptionId = paymentData.subscription_id;
      }
      
      // Preparar dados do pagamento para registro
      const pagamentoDados = {
        planName: selectedPlan.nome,
        amount: paymentData.amount || selectedPlan.preco * 100, // Em centavos
        paymentMethod: paymentData.paymentMethod || paymentMethod,
        status: paymentData.status || 'succeeded',
        stripePaymentId: paymentId,
        tipo: paymentData.tipo || (paymentMethod === 'credit' ? 'assinatura' : 
               paymentMethod === 'pix' ? 'pagamento_pix' : 'pagamento_unico'),
        creditosAdicionados: selectedPlan.relatorios,
        creditosAnteriores: creditosExistentes,
        creditosTotais: subscriptionData.reportsLeft
      };
      
      console.log('[DEBUG PAYMENT] Registrando pagamento no Firebase:', pagamentoDados);
      console.log('[DEBUG PAYMENT] Dados de assinatura:', subscriptionData);
      
      try {
        // Registrar o pagamento no Firebase
        const registroResult = await registrarPagamento(
          currentUser.uid,
          pagamentoDados,
          subscriptionData
        );
        
        if (!registroResult.success) {
          console.error('[DEBUG PAYMENT] Falha ao registrar pagamento:', registroResult.error);
          throw new Error(registroResult.error || 'Erro ao registrar pagamento');
        }
        
        console.log('[DEBUG PAYMENT] Pagamento registrado com sucesso:', registroResult);
        
        // Adicionar este pagamento à lista de processados
        processedPayments.push(paymentId);
        localStorage.setItem(processedPaymentsKey, JSON.stringify(processedPayments));
        
        // Atualizar UI
        setPaymentStatus('success');
        
        // Se o pagamento foi feito com cartão, exibir o modal
        if (paymentMethod === 'credit') {
          setShowCardAddedModal(true);
        } else {
          // Se não foi com cartão, redirecionar normalmente após um pequeno delay
          setTimeout(() => {
            navigate('/wallet', { 
              state: { 
                paymentSuccess: true, 
                plan: selectedPlan,
                creditosAnteriores: creditosExistentes,
                creditosTotais: subscriptionData.reportsLeft
              } 
            });
          }, 2000);
        }
      } catch (registroError) {
        console.error('[DEBUG PAYMENT] Erro ao registrar pagamento:', registroError);
        
        // Exibir alerta sobre o erro
        alert(`Erro ao registrar pagamento: ${registroError.message}. Por favor, contate o suporte com o ID do pagamento: ${paymentId}`);
        
        // Ainda assim, atualizar a UI para mostrar sucesso já que o pagamento foi feito
        setPaymentStatus('success');
        
        // Redirecionar após um delay maior
        setTimeout(() => {
          navigate('/wallet', { 
            state: { 
              paymentSuccess: true, 
              plan: selectedPlan, 
              registroComErro: true,
              creditosAnteriores: creditosExistentes,
              creditosTotais: subscriptionData.reportsLeft
            } 
          });
        }, 3000);
      }
      
    } catch (error) {
      console.error('[DEBUG PAYMENT] Erro ao atualizar assinatura:', error);
      setPaymentStatus('error');
      setPaymentError(`O pagamento foi processado, mas houve um erro ao atualizar sua assinatura: ${error.message}. Por favor, contate o suporte.`);
    }
  };

  const handleCardAddedModalClose = () => {
    setShowCardAddedModal(false);
    navigate('/wallet', { 
      state: { paymentSuccess: true, plan: selectedPlan, cardAdded: true } 
    });
  };

  const handlePaymentError = (error) => {
    console.error('Erro no pagamento:', error);
    setPaymentStatus('error');
    setPaymentError(error.message || 'Ocorreu um erro durante o processamento do pagamento.');
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  // Renderizar o resumo da compra e tela de sucesso/erro
  const renderPaymentStatus = () => {
    switch (paymentStatus) {
      case 'processing':
        return (
          <div className="payment-status processing">
            <div className="status-icon">⏳</div>
            <h3>Processando seu pagamento</h3>
            <p>Estamos processando sua transação. Por favor, aguarde...</p>
          </div>
        );
      case 'success':
        return (
          <div className="payment-status success">
            <div className="status-icon">✅</div>
            <h3>Pagamento confirmado!</h3>
            <p>Seu plano foi ativado com sucesso. Você será redirecionado em instantes.</p>
          </div>
        );
      case 'error':
        return (
          <div className="payment-status error">
            <div className="status-icon">❌</div>
            <h3>Erro no pagamento</h3>
            <p>{paymentError || 'Ocorreu um erro durante o processamento do pagamento.'}</p>
            <button 
              className="try-again-button" 
              onClick={() => setPaymentStatus('pending')}
            >
              Tentar novamente
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="payment-container">
      <div className="payment-header">
        <h1>Escolha seu <span className="highlight">Plano</span></h1>
        <p>Selecione o plano ideal para suas necessidades de análise</p>
        {isDev && <p className="dev-mode-notice">Modo de desenvolvimento ativo: Pagamentos serão simulados</p>}
      </div>

      <div className="plans-container">
        {plans.map((plan) => (
          <div 
            key={plan.id}
            className={`plan-card ${selectedPlan?.id === plan.id ? 'selected' : ''}`}
            onClick={() => handlePlanSelect(plan)}
          >
            {plan.desconto > 0 && (
              <div className="discount-badge">
                {plan.desconto}% de desconto
              </div>
            )}
            <h3>{plan.nome}</h3>
            <div className="plan-price">
              <span className="currency">R$</span>
              <span className="amount">{plan.preco}</span>
              <span className="period">/mês</span>
            </div>
            <div className="plan-features">
              <p><strong>{plan.relatorios}</strong> relatórios por mês</p>
              <p>Acesso a todas as análises</p>
              <p>Suporte prioritário</p>
            </div>
            <button 
              className={`select-plan-button ${selectedPlan?.id === plan.id ? 'selected' : ''}`}
            >
              {selectedPlan?.id === plan.id ? 'Plano Selecionado' : 'Selecionar Plano'}
            </button>
          </div>
        ))}
      </div>

      {selectedPlan && paymentStatus === 'pending' && (
        <div className="payment-methods-container">
          <h2>Método de Pagamento</h2>
          <div className="payment-methods">
            <div 
              className={`payment-method ${paymentMethod === 'credit' ? 'selected' : ''}`}
              onClick={() => handlePaymentMethodChange('credit')}
            >
              <div className="payment-method-icon credit-icon">
                💳
              </div>
              <div className="payment-method-details">
                <h4>Cartão de Crédito</h4>
                <p>Cobrança mensal automática</p>
              </div>
            </div>

            <div 
              className={`payment-method ${paymentMethod === 'pix' ? 'selected' : ''}`}
              onClick={() => handlePaymentMethodChange('pix')}
            >
              <div className="payment-method-icon pix-icon">
                📱
              </div>
              <div className="payment-method-details">
                <h4>Pix</h4>
                <p>Pagamento único (não recorrente)</p>
              </div>
            </div>
          </div>
          
          <div className="payment-summary">
            <h3>Resumo da Compra</h3>
            <div className="summary-item">
              <span>Plano</span>
              <span>{selectedPlan.nome}</span>
            </div>
            <div className="summary-item">
              <span>Relatórios</span>
              <span>{selectedPlan.relatorios} relatórios</span>
            </div>
            <div className="summary-item">
              <span>Período</span>
              <span>30 dias</span>
            </div>
            {selectedPlan.desconto > 0 && (
              <div className="summary-item discount">
                <span>Desconto</span>
                <span>{selectedPlan.desconto}%</span>
              </div>
            )}
            <div className="summary-item total">
              <span>Total</span>
              <span>R$ {selectedPlan.preco},00</span>
            </div>
          </div>
        </div>
      )}

      {/* Formulário de pagamento baseado no método selecionado */}
      {paymentStatus === 'pending' && selectedPlan && (
        <div className="payment-form-container">
          {paymentMethod === 'credit' && (
            <Elements stripe={stripePromise}>
              <CheckoutForm 
                selectedPlan={selectedPlan}
                paymentType="subscription"
                onSuccess={handlePaymentSuccess}
                onError={(error) => setPaymentError(error)}
              />
            </Elements>
          )}
          
          {paymentMethod === 'debit' && (
            <Elements stripe={stripePromise}>
              <CheckoutForm
                selectedPlan={selectedPlan}
                paymentType="payment"
                onSuccess={handlePaymentSuccess}
                onError={(error) => setPaymentError(error)}
              />
            </Elements>
          )}
          
          {paymentMethod === 'pix' && (
            <PixCheckout
              selectedPlan={selectedPlan}
              onSuccess={handlePaymentSuccess}
              onError={(error) => setPaymentError(error)}
            />
          )}
        </div>
          )}

      {selectedPlan && paymentStatus === 'pending' && (
          <div className="checkout-actions">
            <button 
              className="back-button checkout" 
              onClick={handleGoBack}
              disabled={paymentStatus !== 'pending'}
            >
              Voltar
            </button>
        </div>
      )}

      {/* Exibir status do pagamento */}
      {paymentStatus !== 'pending' && renderPaymentStatus()}

      {/* Modal para informar sobre adição do cartão */}
      {showCardAddedModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Pagamento Processado com Sucesso!</h3>
            <p>O cartão utilizado foi adicionado como forma de pagamento principal em sua carteira.</p>
            <p>Você pode gerenciar seus cartões a qualquer momento na seção "Carteira".</p>
            <button onClick={handleCardAddedModalClose} className="modal-button">
              Entendi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Payment; 