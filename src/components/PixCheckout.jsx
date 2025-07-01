import { useState, useEffect, useRef } from 'react';
import { criarPagamentoPix } from '../services/paymentService';
import { useAuth } from '../contexts/AuthContext';
import '../styles/CheckoutForm.css';

function PixCheckout({ selectedPlan, onSuccess, onError }) {
  const [isLoading, setIsLoading] = useState(false);
  const [pixData, setPixData] = useState(null);
  const [error, setError] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const auth = useAuth();
  const currentUser = auth?.currentUser;
  const [checkingInterval, setCheckingInterval] = useState(null);
  const paymentIdRef = useRef(null);
  const paymentProcessedRef = useRef(false); // Ref para controlar se o pagamento já foi processado

  // Função para criar o pagamento PIX
  useEffect(() => {
    const createPixPayment = async () => {
      try {
        setIsLoading(true);
        setError(null);
        console.log('[DEBUG PIX] Iniciando criação de pagamento PIX para o plano:', selectedPlan);

        // Criar pagamento PIX
        const response = await criarPagamentoPix({
          user_id: currentUser.uid,
          plano_id: selectedPlan.id,
          valor: selectedPlan.preco // Garantir que o valor está sendo enviado
        });

        console.log('[DEBUG PIX] Resposta da criação do pagamento PIX:', response);

        if (response.success) {
          setPixData({
            qrCodeImage: response.qrcode_image_url,
            pixCopiaECola: response.pix_code,
            id: response.id
          });
          
          console.log('[DEBUG PIX] Dados do PIX configurados:', {
            qrCodeUrl: response.qrcode_image_url,
            id: response.id
          });
          
          // Guardar o ID para verificação posterior
          paymentIdRef.current = response.id;
          
          // Iniciar verificação periódica
          const interval = setInterval(() => {
            checkPaymentStatus(response.id);
          }, 10000); // Verificar a cada 10 segundos
          
          setCheckingInterval(interval);
        } else {
          throw new Error(response.message || 'Erro ao gerar código PIX');
        }
      } catch (error) {
        console.error('[DEBUG PIX] Erro ao processar pagamento PIX:', error);
        setError('Não foi possível gerar o código PIX. Por favor, tente novamente.');
        if (onError) onError(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    if (selectedPlan && currentUser) {
      createPixPayment();
    } else if (selectedPlan && !currentUser) {
      console.log('[DEBUG PIX] Aguardando informações do usuário...');
    }
    
    // Limpar o intervalo quando o componente for desmontado
    return () => {
      if (checkingInterval) {
        clearInterval(checkingInterval);
      }
    };
  }, [selectedPlan, currentUser, onError]);
  
  // Função para verificar o status do pagamento
  const checkPaymentStatus = async (id) => {
    if (!id || paymentProcessedRef.current) return; // Não verificar se já processado
    
    try {
      console.log('[DEBUG PIX] Verificando status do pagamento:', id);
      // Em um ambiente de desenvolvimento, simular pagamento confirmado após alguns segundos
      const isDev = import.meta.env.VITE_DEV_MODE === 'true';
      
      if (isDev && Math.random() < 0.2) { // 20% de chance de confirmar o pagamento a cada verificação
        console.log('[DEBUG PIX] Simulando confirmação de pagamento PIX');
        
        // Limpar o intervalo de verificação
        if (checkingInterval) {
          clearInterval(checkingInterval);
          setCheckingInterval(null);
        }
        
        // Marcar como processado para evitar múltiplas chamadas
        paymentProcessedRef.current = true;
        setProcessingPayment(true);
        
        // Chamar callback de sucesso com todos os dados necessários
        if (onSuccess) {
          console.log('[DEBUG PIX] Chamando callback de sucesso com dados completos de pagamento');
          const paymentData = {
            paymentId: id,
            id: id,
            status: 'succeeded',
            paymentMethod: 'pix',
            amount: selectedPlan.preco * 100, // Converter para centavos
            tipo: 'pagamento_pix',
            planName: selectedPlan.nome,
            stripePaymentId: id
          };
          
          console.log('[DEBUG PIX] Dados enviados para callback:', paymentData);
          onSuccess(paymentData);
        }
        return;
      }
      
      // Em produção, verificar com o servidor
      if (!isDev) {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://api.credanalyzer.com.br'}/stripe/webhook/${id}/status`);
        
        if (response.ok) {
          const data = await response.json();
          console.log('[DEBUG PIX] Resposta da verificação do pagamento:', data);
          
          if (data.status === 'completed' || data.status === 'succeeded') {
            // Limpar o intervalo de verificação
            if (checkingInterval) {
              clearInterval(checkingInterval);
              setCheckingInterval(null);
            }
            
            // Marcar como processado para evitar múltiplas chamadas
            paymentProcessedRef.current = true;
            setProcessingPayment(true);
            
            // Chamar callback de sucesso com dados completos
            if (onSuccess) {
              const paymentData = {
                ...data,
                paymentMethod: 'pix',
                planName: selectedPlan.nome,
                amount: selectedPlan.preco * 100,
                tipo: 'pagamento_pix',
                stripePaymentId: id
              };
              
              console.log('[DEBUG PIX] Dados enviados para callback:', paymentData);
              onSuccess(paymentData);
            }
          }
        }
      }
    } catch (err) {
      console.error('[DEBUG PIX] Erro ao verificar status do pagamento:', err);
    }
  };

  const copyPixCode = () => {
    if (pixData?.pixCopiaECola) {
      navigator.clipboard.writeText(pixData.pixCopiaECola)
        .then(() => {
          alert('Código PIX copiado para a área de transferência!');
        })
        .catch(err => {
          console.error('[DEBUG PIX] Erro ao copiar código:', err);
          alert('Não foi possível copiar o código. Por favor, copie manualmente.');
        });
    }
  };
  
  // Botão para verificar pagamento manualmente
  const handleVerifyPayment = () => {
    if (paymentIdRef.current && !paymentProcessedRef.current) { // Verificar se já foi processado
      console.log('[DEBUG PIX] Verificação manual iniciada pelo usuário');
      checkPaymentStatus(paymentIdRef.current);
    } else if (paymentProcessedRef.current) {
      console.log('[DEBUG PIX] Pagamento já foi processado, aguarde redirecionamento...');
    }
  };

  // Se não houver usuário autenticado, mostrar mensagem de carregamento
  if (!currentUser) {
    return (
      <div className="pix-checkout-container">
        <div className="checkout-loading">
          <p>Carregando informações do usuário...</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="pix-checkout-container">
        <div className="processing-payment">
          <div className="spinner"></div>
          <p>Gerando código PIX...</p>
        </div>
      </div>
    );
  }

  if (processingPayment) {
    return (
      <div className="pix-checkout-container">
        <div className="processing-payment">
          <div className="spinner"></div>
          <p>Processando seu pagamento...</p>
          <p>Aguarde enquanto confirmamos a transação.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pix-checkout-container">
        <div className="payment-error">
          <h3>Erro no Pagamento</h3>
          <p>{error}</p>
          <button className="retry-button" onClick={() => window.location.reload()}>
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  if (pixData) {
    return (
      <div className="pix-checkout-container">
        <div className="pix-content">
          <h3>Pagamento via PIX</h3>
          <p>Escaneie o QR code abaixo ou copie o código PIX para pagar:</p>
          
          <div className="pix-qrcode">
            {pixData.qrCodeImage ? (
              <img 
                src={pixData.qrCodeImage} 
                alt="QR Code PIX" 
                className="qrcode-image"
                onError={(e) => {
                  console.error('[DEBUG PIX] Erro ao carregar QR code');
                  e.target.onerror = null; 
                  e.target.src = 'https://upload.wikimedia.org/wikipedia/commons/d/d0/QR_code_for_mobile_English_Wikipedia.svg';
                }}
              />
            ) : (
              <div className="qrcode-placeholder">
                <p>QR Code não disponível</p>
              </div>
            )}
          </div>
          
          <div className="pix-code-container">
            <p className="pix-code">{pixData.pixCopiaECola || "Código PIX não disponível"}</p>
            <button 
              className="copy-button" 
              onClick={copyPixCode}
              disabled={!pixData.pixCopiaECola}
            >
              Copiar código
            </button>
          </div>
          
          <div className="pix-instructions">
            <p><strong>Instruções:</strong></p>
            <ol>
              <li>Abra o aplicativo do seu banco</li>
              <li>Escolha a opção "Pagar com PIX"</li>
              <li>Escaneie o QR code ou copie e cole o código</li>
              <li>Confirme o pagamento</li>
            </ol>
            <p className="warning">
              <strong>Importante:</strong> Após pagar, aguarde a confirmação automática.
              Caso não seja confirmado em alguns instantes, clique no botão abaixo.
            </p>
          </div>
          
          <button 
            className="verify-button" 
            onClick={handleVerifyPayment}
            disabled={paymentProcessedRef.current}
          >
            Já paguei, verificar pagamento
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default PixCheckout; 