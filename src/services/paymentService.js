/**
 * Serviço para gerenciar comunicação com a API de pagamentos
 */

// URL base da API de pagamentos no backend
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.credanalyzer.com.br';

// Flag para modo de desenvolvimento (mock)
const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true' || true;

// Dados de mock para desenvolvimento
const MOCK_DATA = {
  planos: [
    {
      id: 'basic',
      nome: 'Plano Básico',
      descricao: 'Ideal para iniciantes',
      preco: 35,
      relatorios: 20,
      desconto: 0
    },
    {
      id: 'standard',
      nome: 'Plano Padrão',
      descricao: 'Melhor custo-benefício',
      preco: 55,
      relatorios: 40,
      desconto: 21
    },
    {
      id: 'premium',
      nome: 'Plano Premium',
      descricao: 'Para uso intensivo',
      preco: 75,
      relatorios: 70,
      desconto: 39
    }
  ],
  checkout: {
    success: true,
    clientSecret: 'mock_client_secret_' + Date.now(),
    id: 'mock_payment_' + Date.now(),
    qrcode_image_url: 'https://upload.wikimedia.org/wikipedia/commons/d/d0/QR_code_for_mobile_English_Wikipedia.svg',
    pix_code: '00020101021226890014br.gov.bcb.pix2567pix-qrcode.mercadopago.com/instore/o/v2/7d15a5e8-fe5e-4022-8130-3c91f3bd3f433204000053039865802BR5925MERCADOPAGO MER DE PAGTOS6009SAO PAULO62070503***63044B5C'
  },
  cards: [
    {
      id: 'pm_mock_visa',
      brand: 'visa',
      last4: '4242',
      exp_month: '12',
      exp_year: '2025',
      name: 'Cartão Visa',
      isDefault: true
    },
    {
      id: 'pm_mock_mastercard',
      brand: 'mastercard',
      last4: '5555',
      exp_month: '10',
      exp_year: '2024',
      name: 'Cartão Mastercard',
      isDefault: false
    }
  ],
  payments: [
    {
      id: 'payment_mock_1',
      amount: 3500,
      currency: 'brl',
      status: 'succeeded',
      created: Date.now() / 1000 - 86400,
      payment_method_details: { type: 'card' },
      description: 'Plano Básico - Assinatura Mensal'
    },
    {
      id: 'payment_mock_2',
      amount: 7500,
      currency: 'brl',
      status: 'succeeded',
      created: Date.now() / 1000 - 86400 * 30,
      payment_method_details: { type: 'pix' },
      description: 'Plano Premium - Pagamento único'
    }
  ],
  planoUsuario: {
    success: true,
    tem_plano: true,
    plano: {
      nome: 'Plano Premium',
      relatorios_restantes: 65,
      renovacao_automatica: true,
      data_inicio: new Date(Date.now() - 86400000 * 5).toISOString(),
      data_fim: new Date(Date.now() + 86400000 * 25).toISOString()
    }
  }
};

/**
 * Obtém os planos disponíveis
 * @returns {Promise<Object>} - Lista de planos disponíveis
 */
export const getPlanos = async () => {
  try {
    // Modo de desenvolvimento - retorna dados simulados
    if (DEV_MODE) {
      return {
        success: true,
        planos: MOCK_DATA.planos
      };
    }

    const response = await fetch(`${API_BASE_URL}/stripe/planos/`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Erro ao obter planos');
    }

    return await response.json();
  } catch (error) {
    console.error('Erro ao obter planos:', error);
    throw error;
  }
};

/**
 * Obtém as informações do plano do usuário
 * @param {string} userId - ID do usuário
 * @returns {Promise<Object>} - Informações do plano
 */
export const getPlanoUsuario = async (userId) => {
  try {
    // Modo de desenvolvimento - retorna dados simulados
    if (DEV_MODE) {
      return MOCK_DATA.planoUsuario;
    }

    const response = await fetch(`${API_BASE_URL}/stripe/plano/${userId}`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Erro ao obter plano do usuário');
    }

    return await response.json();
  } catch (error) {
    console.error('Erro ao obter plano do usuário:', error);
    throw error;
  }
};

/**
 * Cria uma sessão de checkout para assinatura
 * @param {Object} paymentData - Dados de pagamento
 * @param {string} paymentData.user_id - ID do usuário
 * @param {string} paymentData.plano_id - ID do plano
 * @returns {Promise<Object>} - Dados da sessão de checkout
 */
export const criarCheckoutAssinatura = async (paymentData) => {
  try {
    // Modo de desenvolvimento - retorna dados simulados
    if (DEV_MODE) {
      return {
        ...MOCK_DATA.checkout,
        message: 'Checkout de assinatura criado com sucesso (modo de desenvolvimento)'
      };
    }

    const response = await fetch(`${API_BASE_URL}/stripe/checkout/assinatura/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paymentData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Erro ao criar sessão de checkout');
    }

    return await response.json();
  } catch (error) {
    console.error('Erro ao criar sessão de checkout:', error);
    throw error;
  }
};

/**
 * Cria uma sessão de checkout para pagamento único
 * @param {Object} paymentData - Dados de pagamento
 * @param {string} paymentData.user_id - ID do usuário
 * @param {string} paymentData.plano_id - ID do plano
 * @returns {Promise<Object>} - Dados da sessão de checkout
 */
export const criarCheckoutPagamento = async (paymentData) => {
  try {
    // Modo de desenvolvimento - retorna dados simulados
    if (DEV_MODE) {
      return {
        ...MOCK_DATA.checkout,
        message: 'Checkout de pagamento criado com sucesso (modo de desenvolvimento)'
      };
    }

    const response = await fetch(`${API_BASE_URL}/stripe/checkout/pagamento/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paymentData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Erro ao criar sessão de checkout');
    }

    return await response.json();
  } catch (error) {
    console.error('Erro ao criar sessão de checkout:', error);
    throw error;
  }
};

/**
 * Lista os cartões de um cliente
 * @param {string} customerId - ID do cliente no Stripe
 * @returns {Promise<Object>} - Lista de cartões
 */
export const listarCartoes = async (customerId) => {
  try {
    // Modo de desenvolvimento - retorna dados simulados
    if (DEV_MODE) {
      return {
        success: true,
        cards: MOCK_DATA.cards
      };
    }

    const response = await fetch(`${API_BASE_URL}/stripe/cartoes/${customerId}`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Erro ao listar cartões');
    }

    return await response.json();
  } catch (error) {
    console.error('Erro ao listar cartões:', error);
    throw error;
  }
};

/**
 * Adiciona um cartão ao cliente
 * @param {Object} cardData - Dados do cartão
 * @param {string} cardData.customer_id - ID do cliente no Stripe
 * @param {string} cardData.payment_method_id - ID do método de pagamento
 * @param {boolean} cardData.set_default - Define como cartão padrão
 * @returns {Promise<Object>} - Resultado da operação
 */
export const adicionarCartao = async (cardData) => {
  try {
    // Modo de desenvolvimento - retorna dados simulados
    if (DEV_MODE) {
      const newCard = {
        id: `pm_mock_${Date.now()}`,
        brand: 'visa',
        last4: '0000',
        exp_month: '12',
        exp_year: '2026',
        name: 'Novo Cartão',
        isDefault: cardData.set_default
      };
      
      MOCK_DATA.cards.push(newCard);
      
      return {
        success: true,
        card: newCard
      };
    }

    const response = await fetch(`${API_BASE_URL}/stripe/cartoes/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cardData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Erro ao adicionar cartão');
    }

    return await response.json();
  } catch (error) {
    console.error('Erro ao adicionar cartão:', error);
    throw error;
  }
};

/**
 * Remove um cartão do cliente
 * @param {string} customerId - ID do cliente no Stripe
 * @param {string} paymentMethodId - ID do método de pagamento
 * @returns {Promise<Object>} - Resultado da operação
 */
export const removerCartao = async (customerId, paymentMethodId) => {
  try {
    // Modo de desenvolvimento - retorna dados simulados
    if (DEV_MODE) {
      MOCK_DATA.cards = MOCK_DATA.cards.filter(card => card.id !== paymentMethodId);
      
      return {
        success: true,
        message: 'Cartão removido com sucesso'
      };
    }

    const response = await fetch(`${API_BASE_URL}/stripe/cartoes/${customerId}/${paymentMethodId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Erro ao remover cartão');
    }

    return await response.json();
  } catch (error) {
    console.error('Erro ao remover cartão:', error);
    throw error;
  }
};

/**
 * Define um cartão como padrão
 * @param {string} customerId - ID do cliente no Stripe
 * @param {string} paymentMethodId - ID do método de pagamento
 * @returns {Promise<Object>} - Resultado da operação
 */
export const definirCartaoPadrao = async (customerId, paymentMethodId) => {
  try {
    // Modo de desenvolvimento - retorna dados simulados
    if (DEV_MODE) {
      MOCK_DATA.cards = MOCK_DATA.cards.map(card => ({
        ...card,
        isDefault: card.id === paymentMethodId
      }));
      
      return {
        success: true,
        message: 'Cartão padrão atualizado com sucesso'
      };
    }

    const response = await fetch(`${API_BASE_URL}/stripe/cartoes/${customerId}/${paymentMethodId}/padrao`, {
      method: 'PUT',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Erro ao definir cartão padrão');
    }

    return await response.json();
  } catch (error) {
    console.error('Erro ao definir cartão padrão:', error);
    throw error;
  }
};

/**
 * Obtém o histórico de pagamentos do usuário
 * @param {string} userId - ID do usuário
 * @returns {Promise<Object>} - Histórico de pagamentos
 */
export const obterHistoricoPagamentos = async (userId) => {
  try {
    // Modo de desenvolvimento - retorna dados simulados
    if (DEV_MODE) {
      return {
        success: true,
        payments: MOCK_DATA.payments
      };
    }

    const response = await fetch(`${API_BASE_URL}/stripe/pagamentos/${userId}`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Erro ao obter histórico de pagamentos');
    }

    return await response.json();
  } catch (error) {
    console.error('Erro ao obter histórico de pagamentos:', error);
    throw error;
  }
};

/**
 * Cancela a assinatura do usuário
 * @param {string} userId - ID do usuário
 * @returns {Promise<Object>} - Resultado da operação
 */
export const cancelarAssinatura = async (userId) => {
  try {
    // Modo de desenvolvimento - retorna dados simulados
    if (DEV_MODE) {
      MOCK_DATA.planoUsuario.plano.renovacao_automatica = false;
      
      return {
        success: true,
        message: 'Assinatura cancelada com sucesso'
      };
    }

    const response = await fetch(`${API_BASE_URL}/stripe/assinatura/cancelar/${userId}`, {
      method: 'POST',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Erro ao cancelar assinatura');
    }

    return await response.json();
  } catch (error) {
    console.error('Erro ao cancelar assinatura:', error);
    throw error;
  }
};

/**
 * Consome um relatório do plano do usuário
 * @param {string} userId - ID do usuário
 * @returns {Promise<Object>} - Resultado da operação
 */
export const consumirRelatorio = async (userId) => {
  try {
    // Modo de desenvolvimento - retorna dados simulados
    if (DEV_MODE) {
      if (MOCK_DATA.planoUsuario.plano.relatorios_restantes > 0) {
        MOCK_DATA.planoUsuario.plano.relatorios_restantes -= 1;
        
        return {
          success: true,
          relatorios_restantes: MOCK_DATA.planoUsuario.plano.relatorios_restantes
        };
      } else {
        return {
          success: false,
          error: 'Não há relatórios disponíveis'
        };
      }
    }

    const response = await fetch(`${API_BASE_URL}/stripe/consumir_relatorio/${userId}`, {
      method: 'POST',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Erro ao consumir relatório');
    }

    return await response.json();
  } catch (error) {
    console.error('Erro ao consumir relatório:', error);
    throw error;
  }
};

/**
 * Cria um cliente no Stripe
 * @param {Object} userData - Dados do usuário
 * @param {string} userData.user_id - ID do usuário
 * @param {string} userData.email - Email do usuário
 * @param {string} userData.nome - Nome do usuário
 * @returns {Promise<Object>} - Resultado da operação
 */
export const criarCliente = async (userData) => {
  try {
    // Modo de desenvolvimento - retorna dados simulados
    if (DEV_MODE) {
      return {
        success: true,
        customer_id: `cus_mock_${Date.now()}`
      };
    }

    const response = await fetch(`${API_BASE_URL}/stripe/cliente/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Erro ao criar cliente');
    }

    return await response.json();
  } catch (error) {
    console.error('Erro ao criar cliente:', error);
    throw error;
  }
}; 