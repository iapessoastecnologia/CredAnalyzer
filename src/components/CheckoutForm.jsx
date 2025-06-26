import { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useAuth } from '../contexts/AuthContext';
import { criarCheckoutAssinatura } from '../services/paymentService';

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: '#32325d',
      fontFamily: '"Poppins", Arial, sans-serif',
      fontSmoothing: 'antialiased',
      fontSize: '16px',
      '::placeholder': {
        color: '#aab7c4',
      },
    },
    invalid: {
      color: '#fa755a',
      iconColor: '#fa755a',
    },
  },
  hidePostalCode: true,
};

function CheckoutForm({ selectedPlan, onPaymentSuccess, onPaymentError }) {
  const stripe = useStripe();
  const elements = useElements();
  const { currentUser } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [succeeded, setSucceeded] = useState(false);
  
  // Verificar se estamos em modo de desenvolvimento
  const isDev = import.meta.env.VITE_DEV_MODE === 'true' || true;

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      // O Stripe.js ainda não foi carregado
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // Em modo de desenvolvimento, podemos pular a criação do payment method
      // e simular diretamente uma resposta de sucesso
      let paymentMethodId = 'pm_mock_card';
      
      if (!isDev) {
        // Cria um payment method usando CardElement
        const { error, paymentMethod } = await stripe.createPaymentMethod({
          type: 'card',
          card: elements.getElement(CardElement),
          billing_details: {
            email: currentUser.email,
          },
        });

        if (error) {
          setError(`Erro de pagamento: ${error.message}`);
          setProcessing(false);
          if (onPaymentError) onPaymentError(error);
          return;
        }
        
        paymentMethodId = paymentMethod.id;
      }

      // Prepara os dados para a assinatura
      const paymentData = {
        user_id: currentUser.uid,
        plano_id: selectedPlan.id,
        payment_method_id: paymentMethodId
      };

      // Envia a solicitação de checkout para o backend
      const responseData = await criarCheckoutAssinatura(paymentData);

      if (responseData.error) {
        setError(`Erro: ${responseData.error}`);
        setProcessing(false);
        if (onPaymentError) onPaymentError(responseData.error);
        return;
      }

      // Se houver uma intenção de pagamento que requer autenticação
      if (!isDev && responseData.requiresAction) {
        const { error: confirmationError } = await stripe.confirmCardPayment(
          responseData.clientSecret
        );

        if (confirmationError) {
          setError(`Erro na confirmação: ${confirmationError.message}`);
          setProcessing(false);
          if (onPaymentError) onPaymentError(confirmationError);
          return;
        }
      }

      // Pagamento realizado com sucesso
      setSucceeded(true);
      setProcessing(false);
      if (onPaymentSuccess) onPaymentSuccess(responseData);
      
    } catch (err) {
      console.error('Erro na transação:', err);
      setError(`Erro na transação: ${err.message || 'Erro desconhecido'}`);
      setProcessing(false);
      if (onPaymentError) onPaymentError(err);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="checkout-form">
      <div className="form-group">
        <label htmlFor="card-element">Cartão de Crédito</label>
        <div className="card-element-container">
          <CardElement id="card-element" options={CARD_ELEMENT_OPTIONS} />
        </div>
        {isDev && (
          <div className="dev-mode-notice">
            <small>Modo de desenvolvimento ativo: Pagamentos serão simulados</small>
          </div>
        )}
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <button 
        type="submit" 
        className="checkout-button" 
        disabled={(!isDev && !stripe) || processing || succeeded}
      >
        {processing ? 'Processando...' : succeeded ? 'Pagamento Confirmado!' : 'Finalizar Pagamento'}
      </button>

      <div className="security-info">
        <span className="secure-icon">🔒</span>
        <span className="secure-text">Seus dados são transmitidos de forma segura por criptografia SSL</span>
      </div>
    </form>
  );
}

export default CheckoutForm; 