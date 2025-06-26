import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import '../styles/Payment.css';

function Payment() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('credit');

  // Dados dos planos
  const plans = [
    {
      id: 'basic',
      name: 'Plano Básico',
      reports: 20,
      price: 35,
      discount: 0
    },
    {
      id: 'standard',
      name: 'Plano Padrão',
      reports: 40,
      price: 55,
      discount: 21 // ((40 * 35/20) - 55) / (40 * 35/20) * 100 ≈ 21%
    },
    {
      id: 'premium',
      name: 'Plano Premium',
      reports: 70,
      price: 75,
      discount: 39 // ((70 * 35/20) - 75) / (70 * 35/20) * 100 ≈ 39%
    }
  ];

  const handlePlanSelect = (plan) => {
    setSelectedPlan(plan);
  };

  const handlePaymentMethodChange = (method) => {
    setPaymentMethod(method);
  };

  const handleProceedToCheckout = () => {
    // Aqui será implementada a integração com o Stripe
    console.log('Prosseguindo para pagamento com:', selectedPlan, paymentMethod);
    // Por enquanto, apenas navegue para uma página de sucesso simulada
    navigate('/profile');
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <div className="payment-container">
      <div className="payment-header">
        <h1>Escolha seu <span className="highlight">Plano</span></h1>
        <p>Selecione o plano ideal para suas necessidades de análise</p>
      </div>

      <div className="plans-container">
        {plans.map((plan) => (
          <div 
            key={plan.id}
            className={`plan-card ${selectedPlan?.id === plan.id ? 'selected' : ''}`}
            onClick={() => handlePlanSelect(plan)}
          >
            {plan.discount > 0 && (
              <div className="discount-badge">
                {plan.discount}% de desconto
              </div>
            )}
            <h3>{plan.name}</h3>
            <div className="plan-price">
              <span className="currency">R$</span>
              <span className="amount">{plan.price}</span>
              <span className="period">/mês</span>
            </div>
            <div className="plan-features">
              <p><strong>{plan.reports}</strong> relatórios por mês</p>
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

      {selectedPlan && (
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
              <span>{selectedPlan.name}</span>
            </div>
            <div className="summary-item">
              <span>Relatórios</span>
              <span>{selectedPlan.reports} relatórios</span>
            </div>
            <div className="summary-item">
              <span>Período</span>
              <span>30 dias</span>
            </div>
            {selectedPlan.discount > 0 && (
              <div className="summary-item discount">
                <span>Desconto</span>
                <span>{selectedPlan.discount}%</span>
              </div>
            )}
            <div className="summary-item total">
              <span>Total</span>
              <span>R$ {selectedPlan.price},00</span>
            </div>
          </div>

          <div className="checkout-actions">
            <button 
              className="back-button checkout" 
              onClick={handleGoBack}
            >
              Voltar
            </button>
            <button 
              className="checkout-button" 
              onClick={handleProceedToCheckout}
            >
              Finalizar Compra
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Payment; 