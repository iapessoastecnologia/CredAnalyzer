/**
 * Serviço para gerenciar comunicação com a API de pagamentos
 */

// URL base da API de pagamentos no backend
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.credanalyzer.com.br';

// Flag para modo de desenvolvimento (mock)
// Usar a variável de ambiente para definir o modo de desenvolvimento
export const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';

// Import Firebase
import { db } from '../firebase/config';
import { collection, addDoc, doc, setDoc, updateDoc, serverTimestamp, getDoc, query, where, limit, getDocs, orderBy } from 'firebase/firestore';

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
 * Registra informações de pagamento no Firebase e no backend
 * @param {string} userId - ID do usuário
 * @param {Object} paymentData - Dados do pagamento
 * @param {string} paymentData.planName - Nome do plano adquirido
 * @param {number} paymentData.amount - Valor do pagamento
 * @param {string} paymentData.paymentMethod - Método de pagamento (credit, pix)
 * @param {string} paymentData.status - Status do pagamento
 * @param {string} paymentData.stripePaymentId - ID do pagamento no Stripe
 * @param {string} paymentData.tipo - Tipo de pagamento (assinatura, pagamento_unico, renovacao_assinatura, pagamento_pix)
 * @param {Object} subscriptionData - Dados de assinatura
 * @returns {Promise<Object>} - Resultado da operação
 */
export const registrarPagamento = async (userId, paymentData, subscriptionData) => {
  try {
    console.log('[DEBUG REGISTRO] Iniciando registro de pagamento:', { userId, paymentData, subscriptionData });

    // Verificar dados obrigatórios
    if (!userId) {
      throw new Error('ID do usuário é obrigatório');
    }

    if (!paymentData || !paymentData.planName || !paymentData.amount) {
      throw new Error('Dados de pagamento incompletos');
    }

    if (!subscriptionData || !subscriptionData.planId || !subscriptionData.reportsLeft) {
      throw new Error('Dados de assinatura incompletos');
    }

    // Preparando os dados para enviar ao backend
    const backendPaymentData = {
      user_id: userId,
      payment_id: paymentData.stripePaymentId || `payment_${Date.now()}`,
      payment_method: paymentData.paymentMethod,
      amount: paymentData.amount / 100, // Converter de centavos para reais
      plan_id: subscriptionData.planId,
      plan_name: paymentData.planName,
      telefone: subscriptionData.telefone || '',
      auto_renew: subscriptionData.autoRenew || false,
      reports_left: subscriptionData.reportsLeft,
      start_date: subscriptionData.startDate instanceof Date ?
        subscriptionData.startDate.toISOString() :
        new Date(subscriptionData.startDate).toISOString(),
      end_date: subscriptionData.endDate instanceof Date ?
        subscriptionData.endDate.toISOString() :
        new Date(subscriptionData.endDate).toISOString()
    };

    console.log('[DEBUG REGISTRO] Dados formatados para o backend:', backendPaymentData);
    console.log('[DEBUG REGISTRO] Modo de desenvolvimento?', DEV_MODE ? 'SIM' : 'NÃO');

    // Modo de desenvolvimento (SEMPRE TRUE NESTA VERSÃO)
    if (DEV_MODE) {
      console.log('[DEBUG REGISTRO] Registro de pagamento (modo DEV) - salvando no Firebase diretamente');

      // Verificar se este pagamento já foi registrado anteriormente
      try {
        console.log('[DEBUG REGISTRO] Verificando se o pagamento já existe...');
        const paymentId = backendPaymentData.payment_id;
        const existingPaymentDoc = await getDoc(doc(db, "pagamentos", paymentId));

        if (existingPaymentDoc.exists()) {
          console.log('[DEBUG REGISTRO] Pagamento já registrado anteriormente com ID:', paymentId);
          return {
            success: true,
            paymentId: paymentId,
            message: 'Pagamento já registrado anteriormente',
            alreadyExists: true
          };
        }

        // Verificar também na coleção de histórico
        const historyRef = collection(db, "pagamentos_historico");
        const historyQuery = query(
          historyRef,
          where("stripePaymentId", "==", paymentId),
          limit(1)
        );

        const historySnapshot = await getDocs(historyQuery);
        if (!historySnapshot.empty) {
          console.log('[DEBUG REGISTRO] Pagamento já registrado no histórico com ID:', paymentId);
          return {
            success: true,
            paymentId: paymentId,
            message: 'Pagamento já registrado no histórico',
            alreadyExists: true
          };
        }
      } catch (checkError) {
        console.error('[DEBUG REGISTRO] Erro ao verificar existência do pagamento:', checkError);
        // Continuar com o processo mesmo se a verificação falhar
      }

      // Atualizar o localStorage para manter consistência no modo DEV
      const mockUserData = {
        temPlano: true,
        plano: {
          nome: subscriptionData.planName,
          relatorios_restantes: subscriptionData.reportsLeft,
          renovacao_automatica: subscriptionData.autoRenew,
          data_inicio: subscriptionData.startDate instanceof Date ?
            subscriptionData.startDate.toISOString() :
            new Date(subscriptionData.startDate).toISOString(),
          data_fim: subscriptionData.endDate instanceof Date ?
            subscriptionData.endDate.toISOString() :
            new Date(subscriptionData.endDate).toISOString()
        }
      };

      localStorage.setItem('mock_user_data_' + userId, JSON.stringify(mockUserData));
      console.log('[DEBUG REGISTRO] Dados do usuário salvos no localStorage');

      // Em modo de desenvolvimento, também salvar no Firebase diretamente
      try {
        console.log('[DEBUG REGISTRO] Tentando salvar no Firebase...');

        // Gerar um ID único para o pagamento se não for fornecido
        // Isso ajuda a evitar duplicações
        if (!backendPaymentData.payment_id.includes('_')) {
          backendPaymentData.payment_id = `payment_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        }

        // 1. Registrar no histórico de pagamentos (para compatibilidade)
        const pagamentoHistorico = {
          usuarioId: userId,
          planName: paymentData.planName,
          amount: paymentData.amount,
          paymentMethod: paymentData.paymentMethod,
          timestamp: serverTimestamp(),
          status: paymentData.status,
          stripePaymentId: backendPaymentData.payment_id,
          tipo: paymentData.tipo
        };

        console.log('[DEBUG REGISTRO] Salvando em pagamentos_historico:', pagamentoHistorico);
        const historyRef = collection(db, "pagamentos_historico");
        try {
          const docRef = await addDoc(historyRef, pagamentoHistorico);
          console.log('[DEBUG REGISTRO] Pagamento registrado em pagamentos_historico com ID:', docRef.id);
        } catch (historyError) {
          console.error('[DEBUG REGISTRO] Erro ao salvar no histórico:', historyError);
          // Continuar mesmo em caso de erro no histórico
        }

        // 2. Registrar pagamento na nova estrutura
        const pagamentoDoc = {
          userId: userId,
          temPlano: true,
          telefone: subscriptionData?.telefone || '',
          subscription: {
            autoRenew: subscriptionData.autoRenew,
            endDate: subscriptionData.endDate,
            paymentInfo: {
              amount: paymentData.amount,
              lastPaymentDate: new Date().toISOString(),
              paymentId: backendPaymentData.payment_id,
              paymentMethod: paymentData.paymentMethod,
              planId: subscriptionData.planId,
              planName: paymentData.planName
            },
            reportsLeft: subscriptionData.reportsLeft,
            startDate: subscriptionData.startDate
          }
        };

        console.log('[DEBUG REGISTRO] Salvando em pagamentos:', pagamentoDoc);
        try {
          await setDoc(doc(db, "pagamentos", backendPaymentData.payment_id), pagamentoDoc);
          console.log('[DEBUG REGISTRO] Pagamento registrado em pagamentos com ID:', backendPaymentData.payment_id);
        } catch (pagamentoError) {
          console.error('[DEBUG REGISTRO] Erro ao salvar em pagamentos:', pagamentoError);
          throw pagamentoError; // Este é crítico, então lançamos o erro
        }

        // 3. Atualizar informações de assinatura no usuário
        const userSubscription = {
          planName: subscriptionData.planName,
          reportsLeft: subscriptionData.reportsLeft,
          startDate: subscriptionData.startDate,
          endDate: subscriptionData.endDate,
          autoRenew: subscriptionData.autoRenew,
          stripeCustomerId: subscriptionData.stripeCustomerId || null,
          stripeSubscriptionId: subscriptionData.stripeSubscriptionId || null
        };

        console.log('[DEBUG REGISTRO] Atualizando usuário com ID:', userId);
        try {
          let creditosFinais = subscriptionData.reportsLeft;
          if (subscriptionData.singleCreditAddition) {
            // Se o flag estiver presente, calcular os créditos corretamente
            creditosFinais = (subscriptionData.creditosAnteriores || 0) + (subscriptionData.creditosAdicionados || 0);
          }
          await updateDoc(doc(db, "usuarios", userId), {
            subscription: userSubscription,
            temPlano: true,
            creditosRestantes: creditosFinais
          });
          console.log('[DEBUG REGISTRO] Assinatura do usuário atualizada com sucesso');

          // Registrar a mudança de plano com a soma de créditos no histórico
          if (subscriptionData.previousPlan) {
            try {
              const mudancaPlanoRef = collection(db, "mudancas_plano");
              await addDoc(mudancaPlanoRef, {
                usuarioId: userId,
                planoAnterior: subscriptionData.previousPlan,
                planoNovo: subscriptionData.planName,
                creditosAnteriores: subscriptionData.reportsLeft - subscriptionData.creditosAdicionados || 0,
                creditosAdicionados: subscriptionData.creditosAdicionados || subscriptionData.reportsLeft,
                creditosTotais: subscriptionData.reportsLeft,
                timestamp: serverTimestamp()
              });
              console.log('[DEBUG REGISTRO] Histórico de mudança de plano registrado com sucesso');
            } catch (historyError) {
              console.error('[DEBUG REGISTRO] Erro ao registrar histórico de mudança de plano:', historyError);
              // Não crítico, continuar
            }
          }
        } catch (userError) {
          console.error('[DEBUG REGISTRO] Erro ao atualizar usuário:', userError);
          // Não lançar erro aqui, pois o pagamento já foi registrado
        }

        return {
          success: true,
          paymentId: backendPaymentData.payment_id,
          message: 'Pagamento registrado com sucesso no Firebase'
        };
      } catch (error) {
        console.error('[DEBUG REGISTRO] ERRO ao salvar no Firebase (modo DEV):', error);
        alert(`Erro ao salvar no Firebase: ${error.message}`);
        throw error;
      }
    }
    else {
      // Modo produção - enviar para o backend via API
      try {
        console.log(`[DEBUG REGISTRO] Enviando pagamento para ${API_BASE_URL}/pagamentos/`);

        const response = await fetch(`${API_BASE_URL}/pagamentos/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(backendPaymentData),
        });

        if (!response.ok) {
          console.error('[DEBUG REGISTRO] Erro na resposta da API:', response.status, response.statusText);
          const errorData = await response.json().catch(e => ({ detail: "Erro ao processar resposta" }));
          throw new Error(errorData.detail || 'Erro ao registrar pagamento');
        }

        const responseData = await response.json();
        console.log('[DEBUG REGISTRO] Resposta da API:', responseData);
        return responseData;
      } catch (error) {
        console.error('[DEBUG REGISTRO] Erro ao registrar pagamento via API:', error);
        throw error;
      }
    }
  } catch (error) {
    console.error('[DEBUG REGISTRO] Erro geral ao registrar pagamento:', error);
    return {
      success: false,
      error: error.message || 'Erro desconhecido ao registrar pagamento'
    };
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
    console.log('[DEBUG] Buscando histórico de pagamentos para o usuário:', userId);

    // Mesmo em modo de desenvolvimento, buscar diretamente do Firebase
    if (DEV_MODE) {
      try {
        console.log('[DEBUG] Buscando pagamentos do Firebase para o usuário:', userId);

        // Buscar da coleção pagamentos_historico
        const historyRef = collection(db, "pagamentos_historico");
        const historyQuery = query(
          historyRef,
          where("usuarioId", "==", userId),
          orderBy("timestamp", "desc")
        );

        const historySnapshot = await getDocs(historyQuery);
        const payments = [];

        historySnapshot.forEach((doc) => {
          const data = doc.data();
          payments.push({
            id: doc.id,
            payment_id: data.stripePaymentId || doc.id,
            amount: data.amount,
            currency: 'brl',
            status: data.status || 'succeeded',
            created: data.timestamp?.toDate?.() || new Date(),
            payment_method_details: { type: data.paymentMethod },
            description: `${data.planName} - ${data.tipo === 'assinatura' ? 'Assinatura Mensal' : 'Pagamento único'}`,
            planName: data.planName
          });
        });

        // Buscar também da nova coleção pagamentos
        const paymentsRef = collection(db, "pagamentos");
        const paymentsQuery = query(
          paymentsRef,
          where("userId", "==", userId)
        );

        const paymentsSnapshot = await getDocs(paymentsQuery);

        paymentsSnapshot.forEach((doc) => {
          const data = doc.data();
          // Verificar se este pagamento já está na lista (evitar duplicatas)
          const paymentId = doc.id;
          if (!payments.some(p => p.payment_id === paymentId)) {
            payments.push({
              id: paymentId,
              payment_id: paymentId,
              amount: data.subscription?.paymentInfo?.amount || 0,
              currency: 'brl',
              status: 'succeeded',
              created: data.subscription?.paymentInfo?.lastPaymentDate || new Date(),
              payment_method_details: {
                type: data.subscription?.paymentInfo?.paymentMethod || 'unknown'
              },
              description: `${data.subscription?.paymentInfo?.planName || 'Plano'} - ${data.subscription?.autoRenew ? 'Assinatura Mensal' : 'Pagamento único'}`,
              planName: data.subscription?.paymentInfo?.planName
            });
          }
        });

        // Remover duplicatas baseadas no ID do pagamento
        const uniquePayments = [];
        const uniqueIds = new Set();

        for (const payment of payments) {
          const uniqueId = payment.payment_id || payment.id;
          if (!uniqueIds.has(uniqueId)) {
            uniqueIds.add(uniqueId);
            uniquePayments.push(payment);
          }
        }

        console.log('[DEBUG] Encontrados', payments.length, 'pagamentos, após remoção de duplicatas:', uniquePayments.length);

        // Ordenar por data (mais recente primeiro)
        uniquePayments.sort((a, b) => {
          const dateA = a.created instanceof Date ? a.created : new Date(a.created);
          const dateB = b.created instanceof Date ? b.created : new Date(b.created);
          return dateB - dateA;
        });

        return {
          success: true,
          payments: uniquePayments
        };
      } catch (error) {
        console.error('[DEBUG] Erro ao buscar pagamentos do Firebase:', error);
        // Fallback para localStorage apenas se falhar a busca no Firebase
        return {
          success: false,
          error: error.message,
          payments: []
        };
      }
    }

    // Modo produção - chamar o backend
    const response = await fetch(`${API_BASE_URL}/stripe/pagamentos/${userId}`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Erro ao obter histórico de pagamentos');
    }

    // Processar a resposta e remover duplicatas
    const responseData = await response.json();

    if (responseData.success && responseData.payments) {
      // Remover duplicatas baseadas no ID do pagamento
      const uniquePayments = [];
      const uniqueIds = new Set();

      for (const payment of responseData.payments) {
        if (!uniqueIds.has(payment.id)) {
          uniqueIds.add(payment.id);
          uniquePayments.push(payment);
        }
      }

      console.log('[DEBUG] API retornou', responseData.payments.length, 'pagamentos, após remoção de duplicatas:', uniquePayments.length);

      return {
        success: true,
        payments: uniquePayments
      };
    }

    return responseData;
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

/**
 * Cria um pagamento via PIX
 * @param {Object} pixData - Dados do pagamento PIX
 * @param {string} pixData.user_id - ID do usuário
 * @param {string} pixData.plano_id - ID do plano
 * @param {number} pixData.valor - Valor do pagamento (opcional)
 * @returns {Promise<Object>} - Dados do pagamento PIX
 */
export const criarPagamentoPix = async (pixData) => {
  try {
    console.log('[DEBUG PIX-SERVICE] Iniciando criação de pagamento PIX:', pixData);

    // Buscar dados do plano se não houver valor definido
    let valor = pixData.valor;
    if (!valor && pixData.plano_id) {
      // Em um cenário real, buscaríamos o valor do plano
      // Aqui estamos usando valores fixos para mock
      const planoValores = {
        'basic': 35,
        'standard': 55,
        'premium': 75
      };
      valor = planoValores[pixData.plano_id] || 0;
    }

    // Modo de desenvolvimento - retorna dados simulados
    if (DEV_MODE) {
      console.log('[DEBUG PIX-SERVICE] Usando modo de desenvolvimento para criar PIX');

      // Gerar um ID único para o pagamento PIX
      const paymentId = `pix_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // Usar uma URL real de QR code
      const mockResponse = {
        ...MOCK_DATA.checkout,
        success: true,
        id: paymentId,
        qrcode_image_url: 'https://upload.wikimedia.org/wikipedia/commons/d/d0/QR_code_for_mobile_English_Wikipedia.svg',
        pix_code: '00020101021226890014br.gov.bcb.pix2567pix-qrcode.exemplo.com/pix/v2/' + paymentId,
        message: 'Pagamento PIX criado com sucesso (modo de desenvolvimento)'
      };

      console.log('[DEBUG PIX-SERVICE] Resposta mockada:', mockResponse);
      return mockResponse;
    }

    console.log('[DEBUG PIX-SERVICE] Enviando requisição para API:', `${API_BASE_URL}/pagamento/pix/`);
    const response = await fetch(`${API_BASE_URL}/pagamento/pix/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pixData),
    });

    if (!response.ok) {
      console.error('[DEBUG PIX-SERVICE] Erro na resposta da API:', response.status, response.statusText);
      const errorData = await response.json().catch(e => ({ detail: "Erro ao processar resposta" }));
      throw new Error(errorData.detail || 'Erro ao criar pagamento PIX');
    }

    const responseData = await response.json();
    console.log('[DEBUG PIX-SERVICE] Resposta da API PIX:', responseData);
    return responseData;
  } catch (error) {
    console.error('[DEBUG PIX-SERVICE] Erro ao criar pagamento PIX:', error);
    throw error;
  }
};

/**
 * Decrementa o número de relatórios disponíveis para o usuário
 * @param {string} userId - ID do usuário
 * @returns {Promise<Object>} - Resultado da operação
 */
export const decrementReportsLeft = async (userId) => {
  try {
    console.log('[DEBUG] Decrementando relatórios para o usuário:', userId);

    // Modo de desenvolvimento - usar localStorage
    if (DEV_MODE) {
      // Verificar se o usuário existe no localStorage
      const userDataJson = localStorage.getItem('mock_user_data_' + userId);

      if (!userDataJson) {
        console.error('[DEBUG] Usuário não encontrado no localStorage');
        return {
          success: false,
          error: 'Usuário não encontrado'
        };
      }

      const userData = JSON.parse(userDataJson);

      // Verificar se tem plano ativo
      if (!userData.temPlano || !userData.plano) {
        console.error('[DEBUG] Usuário não possui plano ativo');
        return {
          success: false,
          error: 'Sem plano ativo'
        };
      }

      // Verificar se tem relatórios disponíveis
      if (userData.plano.relatorios_restantes <= 0) {
        console.error('[DEBUG] Usuário não possui relatórios disponíveis');
        return {
          success: false,
          error: 'Não há relatórios disponíveis'
        };
      }

      // Decrementar e salvar
      userData.plano.relatorios_restantes -= 1;
      localStorage.setItem('mock_user_data_' + userId, JSON.stringify(userData));

      console.log('[DEBUG] Relatórios restantes:', userData.plano.relatorios_restantes);

      // Atualizar também no Firebase
      try {
        // Buscar referência do documento do usuário
        const userRef = doc(db, "usuarios", userId);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();

          if (userData.subscription && userData.subscription.reportsLeft !== undefined) {
            // Decrementar relatórios
            await updateDoc(userRef, {
              "subscription.reportsLeft": userData.subscription.reportsLeft - 1
            });

            console.log('[DEBUG] Relatórios decrementados no Firebase');
          }
        }
      } catch (firebaseError) {
        console.error('[DEBUG] Erro ao atualizar Firebase, mas continuando com localStorage:', firebaseError);
        // Não falhar se o Firebase falhar, já que temos o localStorage
      }

      return {
        success: true,
        relatorios_restantes: userData.plano.relatorios_restantes
      };
    }

    // Modo de produção - chamar API
    const response = await fetch(`${API_BASE_URL}/stripe/consumir_relatorio/${userId}`, {
      method: 'POST',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Erro ao decrementar relatórios');
    }

    return await response.json();
  } catch (error) {
    console.error('Erro ao decrementar relatórios:', error);
    return { success: false, error: error.message };
  }
}; 