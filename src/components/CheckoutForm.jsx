import { useState, useEffect } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useAuth } from '../contexts/AuthContext';
import { criarCheckoutPagamento, criarCheckoutAssinatura } from '../services/paymentService';
import '../styles/CheckoutForm.css';

function CheckoutForm({ selectedPlan, paymentType = 'payment', onSuccess, onError }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [cardComplete, setCardComplete] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  const stripe = useStripe();
  const elements = useElements();
  const auth = useAuth();
  const currentUser = auth?.currentUser;
  
  // Detectar modo escuro
  useEffect(() => {
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(darkModeQuery.matches);
    
    const handleChange = (e) => setIsDarkMode(e.matches);
    darkModeQuery.addEventListener('change', handleChange);
    
    return () => darkModeQuery.removeEventListener('change', handleChange);
  }, []);
  
  // Função que será chamada quando o componente for montado
  useEffect(() => {
    if (!selectedPlan || !currentUser) {
      console.log("[DEBUG] Aguardando plano selecionado ou usuário autenticado");
      return;
    }
    
    const createPaymentIntent = async () => {
      try {
        setIsProcessing(true);
        setMessage('');
        
        // Preparar os dados para o backend
        const paymentData = {
          user_id: currentUser.uid,
          plano_id: selectedPlan.id
        };
        
        // Criar checkout baseado no tipo (pagamento único ou assinatura)
        const checkoutFunction = paymentType === 'subscription' 
          ? criarCheckoutAssinatura
          : criarCheckoutPagamento;
        
        const response = await checkoutFunction(paymentData);
        
        if (response.success && response.clientSecret) {
          setClientSecret(response.clientSecret);
        } else {
          throw new Error(response.message || 'Erro ao criar checkout');
        }
      } catch (error) {
        console.error('Erro ao iniciar checkout:', error);
        setMessage(`Erro ao preparar pagamento: ${error.message}`);
        if (onError) onError(error.message);
      } finally {
        setIsProcessing(false);
      }
    };
    
    createPaymentIntent();
  }, [selectedPlan, paymentType, currentUser, onError]);
  
  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!stripe || !elements || !currentUser) {
      // O Stripe.js ainda não foi carregado ou usuário não autenticado
      return;
    }
    
    setIsProcessing(true);
    setMessage("");

    try {
      // Confirmar o pagamento com o Stripe usando o Client Secret
      const cardElement = elements.getElement(CardElement);
      
      console.log(`[DEBUG] Confirmando ${paymentType} com Stripe...`);
      
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement
        }
      });

      if (error) {
        setMessage(error.message || "Ocorreu um erro durante o processamento do pagamento.");
        setIsProcessing(false);
        if (onError) onError(error.message);
      } else if (paymentIntent) {
        console.log('[DEBUG] Pagamento confirmado pelo Stripe:', paymentIntent);
        
        // Prepare os dados de pagamento para passar para o callback de sucesso
        const paymentData = {
          id: paymentIntent.id,
          paymentId: paymentIntent.id,
          status: paymentIntent.status,
          amount: paymentIntent.amount,
          paymentMethod: 'credit',
          stripePaymentId: paymentIntent.id,
          tipo: paymentType === 'subscription' ? 'assinatura' : 'pagamento_unico',
          planName: selectedPlan.nome
        };
        
        console.log('[DEBUG] Dados de pagamento formatados para callback:', paymentData);
        
        setMessage("Pagamento processado com sucesso!");
        setIsProcessing(false);
        
        // Chamar o callback de sucesso com os dados do pagamento
        if (onSuccess) {
          console.log('[DEBUG] Chamando callback de sucesso');
          onSuccess(paymentData);
        }
      }
    } catch (error) {
      console.error('[DEBUG] Erro ao processar pagamento:', error);
      setMessage("Ocorreu um erro durante o processamento do pagamento.");
      setIsProcessing(false);
      if (onError) onError(error.message);
    }
  };
  
  const handleCardChange = (event) => {
    setCardComplete(event.complete);
    if (event.error) {
      setMessage(event.error.message);
    } else {
      setMessage('');
    }
  };
  
  // Definir estilos para o campo de cartão com base no tema
  const cardElementStyle = {
    style: {
      base: {
        fontSize: '16px',
        color: isDarkMode ? '#e0e0e0' : '#424770',
        '::placeholder': {
          color: isDarkMode ? '#aaa' : '#aab7c4',
        },
        iconColor: isDarkMode ? '#ffc000' : '#0B3954',
      },
      invalid: {
        color: '#9e2146',
        iconColor: isDarkMode ? '#ff6b6b' : '#9e2146',
      },
    },
    hidePostalCode: true
  };
  
  // Se não houver usuário autenticado, mostrar mensagem de carregamento
  if (!currentUser) {
    return (
      <div className="checkout-form-container">
        <div className="checkout-loading">
          <p>Carregando informações do usuário...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="checkout-form-container">
      <form onSubmit={handleSubmit} className="checkout-form">
        <div className="card-element-container">
          <CardElement 
            options={cardElementStyle}
            onChange={handleCardChange}
          />
        </div>
        
        <button 
          type="submit" 
          disabled={isProcessing || !cardComplete || !stripe} 
          className="checkout-button"
        >
          {isProcessing ? 'Processando...' : 'Pagar agora'}
        </button>
        
        {message && <div className="checkout-message">{message}</div>}
        
        <div className="security-info">
          <span className="secure-icon">🔒</span>
          <span className="secure-text">Pagamento seguro com Stripe</span>
        </div>
      </form>
    </div>
  );
}

export default CheckoutForm; 