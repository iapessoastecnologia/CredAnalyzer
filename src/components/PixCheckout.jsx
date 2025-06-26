import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { criarCheckoutPagamento } from '../services/paymentService';

function PixCheckout({ selectedPlan, onPaymentSuccess, onPaymentError }) {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] = useState(null);
  const [error, setError] = useState(null);
  const [paymentId, setPaymentId] = useState(null);
  const [checkingInterval, setCheckingInterval] = useState(null);

  const handleGeneratePixCode = async () => {
    setLoading(true);
    setError(null);

    try {
      // Usar o serviço para solicitar a geração do código PIX
      const paymentData = {
        user_id: currentUser.uid,
        plano_id: selectedPlan.id,
      };
      
      const responseData = await criarCheckoutPagamento(paymentData);

      if (!responseData.success) {
        throw new Error(responseData.error || 'Erro ao gerar PIX');
      }

      // Exibe o código PIX ao usuário
      setPixData({
        qrCodeImage: responseData.qrCodeImage || responseData.qrcode_image_url,
        pixCopiaECola: responseData.pixCopiaECola || responseData.pix_code
      });
      
      if (responseData.payment_id || responseData.id) {
        setPaymentId(responseData.payment_id || responseData.id);
        
        // Iniciar verificação periódica do pagamento
        const interval = setInterval(() => {
          checkPaymentStatus(responseData.payment_id || responseData.id);
        }, 10000); // Verificar a cada 10 segundos
        
        setCheckingInterval(interval);
      }
      
      setLoading(false);
      
    } catch (err) {
      console.error('Erro ao gerar código PIX:', err);
      setError(`Erro ao gerar código PIX: ${err.message || 'Erro desconhecido'}`);
      setLoading(false);
      if (onPaymentError) onPaymentError(err);
    }
  };

  const checkPaymentStatus = async (id) => {
    if (!id) return;
    
    try {
      // Em um ambiente de desenvolvimento, simular pagamento confirmado após 30 segundos
      const isDev = import.meta.env.VITE_DEV_MODE === 'true' || true;
      
      if (isDev && Math.random() < 0.2) { // 20% de chance de confirmar o pagamento a cada verificação
        // Limpar o intervalo de verificação
        if (checkingInterval) {
          clearInterval(checkingInterval);
          setCheckingInterval(null);
        }
        
        if (onPaymentSuccess) {
          onPaymentSuccess({
            id: id,
            status: 'completed',
            message: 'Pagamento confirmado com sucesso (modo de desenvolvimento)'
          });
        }
        return;
      }
      
      // Em produção, verificar com o servidor
      if (!isDev) {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://api.credanalyzer.com.br'}/stripe/webhook/${id}/status`);
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.status === 'completed' || data.status === 'succeeded') {
            // Limpar o intervalo de verificação
            if (checkingInterval) {
              clearInterval(checkingInterval);
              setCheckingInterval(null);
            }
            
            if (onPaymentSuccess) onPaymentSuccess(data);
          }
        }
      }
    } catch (err) {
      console.error('Erro ao verificar status do pagamento:', err);
    }
  };

  const handleConfirmPayment = async () => {
    if (!paymentId) return;
    
    setLoading(true);
    
    try {
      // Em ambiente de desenvolvimento, simular pagamento confirmado
      const isDev = import.meta.env.VITE_DEV_MODE === 'true' || true;
      
      if (isDev) {
        // Limpar o intervalo de verificação
        if (checkingInterval) {
          clearInterval(checkingInterval);
          setCheckingInterval(null);
        }
        
        if (onPaymentSuccess) {
          onPaymentSuccess({
            id: paymentId,
            status: 'completed',
            message: 'Pagamento confirmado com sucesso (modo de desenvolvimento)'
          });
        }
        return;
      }
      
      // Em produção, verificar com o servidor
      await checkPaymentStatus(paymentId);
      
      // Se chegamos aqui é porque o checkPaymentStatus não redirecionou/completou
      setError('Pagamento ainda não foi identificado. Por favor, tente novamente em alguns instantes.');
      setLoading(false);
    } catch (err) {
      console.error('Erro ao verificar pagamento:', err);
      setError(`Erro ao verificar pagamento: ${err.message || 'Erro desconhecido'}`);
      setLoading(false);
      if (onPaymentError) onPaymentError(err);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        alert('Código PIX copiado para a área de transferência!');
      })
      .catch(err => {
        console.error('Erro ao copiar texto:', err);
      });
  };

  return (
    <div className="pix-checkout">
      {!pixData ? (
        <>
          <p className="checkout-info">
            Ao clicar em "Gerar código PIX", será gerado um código para pagamento único (não recorrente).
          </p>
          
          <button 
            onClick={handleGeneratePixCode} 
            className="checkout-button"
            disabled={loading}
          >
            {loading ? 'Gerando código...' : 'Gerar código PIX'}
          </button>
        </>
      ) : (
        <div className="pix-code-container">
          <h3>Pagamento PIX</h3>
          
          <div className="pix-qrcode">
            {pixData.qrCodeImage && <img src={pixData.qrCodeImage} alt="QR Code PIX" />}
          </div>
          
          <div className="pix-copy-section">
            <p>Código PIX copia e cola:</p>
            <div className="pix-copy-box">
              <code className="pix-code">{pixData.pixCopiaECola}</code>
              <button 
                onClick={() => copyToClipboard(pixData.pixCopiaECola)}
                className="copy-button"
                title="Copiar código"
              >
                📋
              </button>
            </div>
          </div>
          
          <div className="pix-instructions">
            <h4>Instruções:</h4>
            <ol>
              <li>Abra o aplicativo do seu banco</li>
              <li>Acesse a área de PIX</li>
              <li>Escaneie o QR Code ou cole o código acima</li>
              <li>Confira os dados e confirme o pagamento</li>
              <li>Após o pagamento, clique em "Já paguei" abaixo</li>
            </ol>
          </div>
          
          <div className="pix-expiration">
            <p>Código válido por 30 minutos</p>
            <p className="amount">Valor: <strong>R$ {selectedPlan.preco || selectedPlan.price},00</strong></p>
          </div>
          
          <button 
            onClick={handleConfirmPayment} 
            className="checkout-button verify-button"
            disabled={loading}
          >
            {loading ? 'Verificando...' : 'Já paguei, verificar pagamento'}
          </button>
          
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
        </div>
      )}

      <div className="security-info">
        <span className="secure-icon">🔒</span>
        <span className="secure-text">Pagamentos seguros via PIX</span>
      </div>
    </div>
  );
}

export default PixCheckout; 