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
  cards: [], // Removidos cartões padrão
  payments: [], // Removido histórico de pagamentos padrão
  planoUsuario: {
    success: true,
    tem_plano: false, // Usuário não tem plano por padrão
    plano: null
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
      // Verificar se o usuário existe no localStorage
      const userData = localStorage.getItem('mock_user_data_' + userId);
      
      if (userData) {
        // Se temos dados do usuário, verificar se ele tem plano
        const parsedData = JSON.parse(userData);
        if (parsedData.temPlano) {
          return {
            success: true,
            tem_plano: true,
            plano: parsedData.plano
          };
        }
      }
      
      // Por padrão retornar que não tem plano
      return {
        success: true,
        tem_plano: false,
        plano: null
      };
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
      // Verificar se o usuário tem cartões salvos no localStorage
      const userCardsKey = 'mock_user_cards_' + customerId;
      const savedCards = localStorage.getItem(userCardsKey);
      
      if (savedCards) {
        return {
          success: true,
          cards: JSON.parse(savedCards)
        };
      }
      
      // Por padrão, retornar lista vazia
      return {
        success: true,
        cards: []
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
      
      // Verificar se temos cartões salvos para o usuário
      const userCardsKey = 'mock_user_cards_' + cardData.customer_id;
      const savedCardsJson = localStorage.getItem(userCardsKey);
      const savedCards = savedCardsJson ? JSON.parse(savedCardsJson) : [];
      
      // Se o novo cartão é padrão, remover padrão dos outros
      if (newCard.isDefault) {
        savedCards.forEach(card => card.isDefault = false);
      }
      
      // Adicionar o novo cartão
      savedCards.push(newCard);
      
      // Salvar no localStorage
      localStorage.setItem(userCardsKey, JSON.stringify(savedCards));
      
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
      // Verificar se o usuário tem um histórico de pagamentos no localStorage
      const userPaymentsKey = 'mock_user_payments_' + userId;
      const savedPayments = localStorage.getItem(userPaymentsKey);
      
      if (savedPayments) {
        return {
          success: true,
          payments: JSON.parse(savedPayments)
        };
      }
      
      // Por padrão, retornar lista vazia
      return {
        success: true,
        payments: []
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
      // Verificar se o usuário existe no localStorage
      const userDataJson = localStorage.getItem('mock_user_data_' + userId);
      
      if (!userDataJson) {
        return {
          success: false,
          error: 'Usuário não encontrado',
          needsUpgrade: true
        };
      }
      
      const userData = JSON.parse(userDataJson);
      
      // Verificar se tem plano ativo
      if (!userData.temPlano || !userData.plano) {
        return {
          success: false,
          error: 'Sem plano ativo',
          needsUpgrade: true
        };
      }
      
      // Verificar se tem relatórios disponíveis
      if (userData.plano.relatorios_restantes <= 0) {
        return {
          success: false,
          error: 'Não há relatórios disponíveis',
          needsUpgrade: true
        };
      }
      
      // Decrementar e salvar
      userData.plano.relatorios_restantes -= 1;
      localStorage.setItem('mock_user_data_' + userId, JSON.stringify(userData));
      
      return {
        success: true,
        relatorios_restantes: userData.plano.relatorios_restantes
      };
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