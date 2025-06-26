import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Elements } from '@stripe/react-stripe-js';
import stripePromise from '../stripe/stripeConfig';
import CheckoutForm from '../components/CheckoutForm';
import PixCheckout from '../components/PixCheckout';
import '../styles/Payment.css';
import '../styles/CheckoutForm.css';
import { getPlanos } from '../services/paymentService';

function Payment() {
  const { currentUser, updateUserSubscription } = useAuth();
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('credit');
  const [paymentStatus, setPaymentStatus] = useState('pending'); // pending, processing, success, error
  const [paymentError, setPaymentError] = useState(null);
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
  const isDev = import.meta.env.VITE_DEV_MODE === 'true' || true;

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
      setPaymentStatus('processing');
      
      // Atualizar o status da assinatura no Firebase
      const subscriptionData = {
        planId: selectedPlan.id,
        planName: selectedPlan.nome,
        reportsLeft: selectedPlan.relatorios,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
        autoRenew: paymentMethod === 'credit', // Renovação automática só para cartão
        paymentInfo: {
          lastPaymentDate: new Date(),
          paymentId: paymentData.paymentId || paymentData.id,
          paymentMethod: paymentMethod
        }
      };
      
      // Em modo de desenvolvimento, podemos simular um atraso
      if (isDev) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        await updateUserSubscription(currentUser.uid, subscriptionData);
      }
      
      // Atualizar UI
      setPaymentStatus('success');
      
      // Navegação após sucesso (com um pequeno delay para mostrar o status de sucesso)
      setTimeout(() => {
        navigate('/wallet', { 
          state: { paymentSuccess: true, plan: selectedPlan } 
        });
      }, 2000);
      
    } catch (error) {
      console.error('Erro ao atualizar assinatura:', error);
      setPaymentStatus('error');
      setPaymentError('O pagamento foi processado, mas houve um erro ao atualizar sua assinatura. Por favor, contate o suporte.');
    }
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

          {/* Componente dinâmico baseado no método de pagamento */}
          {paymentMethod === 'credit' ? (
            <Elements stripe={stripePromise}>
              <CheckoutForm
                selectedPlan={selectedPlan}
                onPaymentSuccess={handlePaymentSuccess}
                onPaymentError={handlePaymentError}
              />
            </Elements>
          ) : (
            <PixCheckout
              selectedPlan={selectedPlan}
              onPaymentSuccess={handlePaymentSuccess}
              onPaymentError={handlePaymentError}
            />
          )}

          <div className="checkout-actions">
            <button 
              className="back-button checkout" 
              onClick={handleGoBack}
              disabled={paymentStatus !== 'pending'}
            >
              Voltar
            </button>
          </div>
        </div>
      )}

      {/* Exibir status do pagamento */}
      {paymentStatus !== 'pending' && renderPaymentStatus()}
    </div>
  );
}

export default Payment; 