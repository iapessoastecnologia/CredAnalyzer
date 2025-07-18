import { createContext, useContext, useEffect, useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { criarCliente, getPlanoUsuario, consumirRelatorio, decrementReportsLeft as decrementReportsLeftService } from '../services/paymentService';

// Flag para modo de desenvolvimento
const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';

const AuthContext = createContext();

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    console.error('[DEBUG AUTH] useAuth() foi chamado fora do AuthProvider! O contexto é undefined.');
  }
  return context;
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userSubscription, setUserSubscription] = useState(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);

  // Registro com email e senha
  async function register(email, password, userData) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // Salvar dados adicionais do usuário no Firestore
      await saveUserData(userCredential.user.uid, {
        ...userData,
        email: email,
        creditosRestantes: 0, // Inicia com zero créditos
        temPlano: false // Flag indicando que o usuário não tem plano
      });
      
      // Criar cliente no Stripe
      try {
        const stripeCustomer = await criarCliente({
          user_id: userCredential.user.uid,
          email: email,
          nome: userData.nome || email.split('@')[0]
        });
        
        if (stripeCustomer.success && stripeCustomer.customer_id) {
          await updateDoc(doc(db, "usuarios", userCredential.user.uid), {
            stripeCustomerId: stripeCustomer.customer_id
          });
        }
      } catch (stripeError) {
        console.error("Erro ao criar cliente no Stripe:", stripeError);
        // Não interrompe o fluxo de registro se houver erro no Stripe
      }
      
      return userCredential;
    } catch (error) {
      throw error;
    }
  }

  // Login com email e senha
  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  // Login com Google
  async function loginWithGoogle() {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      // Verificar se é a primeira vez que o usuário faz login
      const userRef = doc(db, "usuarios", result.user.uid);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        // Se for a primeira vez, salvar dados básicos do usuário
        await saveUserData(result.user.uid, {
          nome: result.user.displayName || '',
          email: result.user.email,
          telefone: '',
          isProfileComplete: false,
          creditosRestantes: 0, // Inicia com zero créditos
          temPlano: false // Flag indicando que o usuário não tem plano
        });
        
        // Criar cliente no Stripe
        try {
          const stripeCustomer = await criarCliente({
            user_id: result.user.uid,
            email: result.user.email,
            nome: result.user.displayName || result.user.email.split('@')[0]
          });
          
          if (stripeCustomer.success && stripeCustomer.customer_id) {
            await updateDoc(doc(db, "usuarios", result.user.uid), {
              stripeCustomerId: stripeCustomer.customer_id
            });
          }
        } catch (stripeError) {
          console.error("Erro ao criar cliente no Stripe:", stripeError);
        }
      }
      
      return result;
    } catch (error) {
      throw error;
    }
  }

  // Salvar dados do usuário no Firestore
  async function saveUserData(uid, data) {
    return await setDoc(doc(db, "usuarios", uid), data);
  }

  // Atualizar dados do usuário
  const updateUserData = async (userId, data) => {
    try {
      const userDocRef = doc(db, 'usuarios', userId);
      await updateDoc(userDocRef, data);
      return true;
    } catch (error) {
      console.error("Erro ao atualizar dados do usuário:", error);
      throw error;
    }
  };
  
  // Atualizar assinatura do usuário
  const updateUserSubscription = async (userId, subscriptionData) => {
    try {
      const userDocRef = doc(db, 'usuarios', userId);
      
      // Verificar se o usuário já possui créditos
      let creditosRestantes = 0;
      let planoAnterior = null;
      
      try {
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // Verificar se o usuário já tem créditos restantes
          // Agora usamos subscription.reportsLeft como fonte principal de créditos restantes
          if (userData.subscription && userData.subscription.reportsLeft > 0) {
            creditosRestantes = userData.subscription.reportsLeft;
            console.log('[DEBUG AUTH] Usuário possui créditos restantes:', creditosRestantes);
          } else if (userData.creditosRestantes && userData.creditosRestantes > 0) {
            // Fallback para o campo antigo, caso não tenha sido migrado ainda
            creditosRestantes = userData.creditosRestantes;
            console.log('[DEBUG AUTH] Usuário possui créditos restantes (campo legado):', creditosRestantes);
          }
          
          // Verificar se já tem plano para registrar o plano anterior
          if (userData.subscription && userData.subscription.planName) {
            planoAnterior = userData.subscription.planName;
            console.log('[DEBUG AUTH] Plano anterior do usuário:', planoAnterior);
          }
        }
      } catch (error) {
        console.error("[DEBUG AUTH] Erro ao verificar créditos existentes:", error);
        // Continuar mesmo com erro - não é crítico
      }
      
      // Armazenar os créditos fixos do plano em creditosPlano
      const creditosPlano = subscriptionData.reportsLeft || 0;
      
      // Atualizar a quantidade de relatórios disponíveis somando os existentes
      if (!subscriptionData.preserveCredits) { // Se não for especificado para preservar os créditos existentes
        // Agora reportsLeft recebe a soma dos créditos restantes + os créditos do novo plano
        subscriptionData.reportsLeft = creditosRestantes + creditosPlano;
      }
      
      // Registrar o plano anterior
      if (planoAnterior && !subscriptionData.previousPlan) {
        subscriptionData.previousPlan = planoAnterior;
      }
      
      await updateDoc(userDocRef, { 
        subscription: subscriptionData,
        creditosRestantes: subscriptionData.reportsLeft, // Para manter compatibilidade
        creditosPlano: creditosPlano, // Novo campo que armazena os créditos fixos do plano
        temPlano: true
      });
      
      // Atualizar o estado de assinatura no contexto
      setUserSubscription({
        planId: subscriptionData.planId,
        planName: subscriptionData.planName,
        reportsLeft: subscriptionData.reportsLeft,
        startDate: subscriptionData.startDate,
        endDate: subscriptionData.endDate,
        autoRenew: subscriptionData.autoRenew
      });
      
      return true;
    } catch (error) {
      console.error("Erro ao atualizar assinatura do usuário:", error);
      throw error;
    }
  };
  
  // Decrementar relatórios restantes
  const decrementReportsLeft = async (userId) => {
    try {
      // Usar a função do serviço de pagamento
      const response = await decrementReportsLeftService(userId);
      
      if (response.success) {
        // Atualizar o estado local se a resposta for bem-sucedida
        if (userSubscription) {
          setUserSubscription({
            ...userSubscription,
            reportsLeft: response.relatorios_restantes
          });
        }
        
        return { 
          success: true,
          reportsLeft: response.relatorios_restantes
        };
      } else {
        console.error("Erro ao decrementar relatórios:", response.error);
        return { 
          success: false,
          error: response.error || "Erro ao decrementar relatórios",
          needsUpgrade: response.needsUpgrade
        };
      }
    } catch (error) {
      console.error("Erro ao decrementar relatórios:", error);
      return { 
        success: false,
        error: error.message
      };
    }
  };
  
  // Carregar informações da assinatura do usuário
  const loadUserSubscription = async (userId, forceRefresh = false) => {
    if (!userId) return null;
    
    setSubscriptionLoading(true);
    try {
      // Obter o documento do usuário primeiro
      const userDoc = await getDoc(doc(db, "usuarios", userId));
      
      if (!userDoc.exists()) {
        setUserSubscription(null);
        setSubscriptionLoading(false);
        return null;
      }
      
      const userData = userDoc.data();
      
      // Se o usuário não tem plano, retornar null
      if (!userData.temPlano) {
        setUserSubscription(null);
        setSubscriptionLoading(false);
        return null;
      }
      
      // Função para processar datas em diferentes formatos
      const processarData = (data) => {
        if (!data) return new Date();
        
        try {
          // Verificar se é um timestamp do Firestore
          if (typeof data === 'object' && data.toDate && typeof data.toDate === 'function') {
            return data.toDate();
          }
          
          // Se já for um objeto Date
          if (data instanceof Date) {
            return data;
          }
          
          // Se for um número (timestamp em milissegundos)
          if (typeof data === 'number') {
            return new Date(data);
          }
          
          // Se for uma string, tentar converter para Date
          if (typeof data === 'string') {
            return new Date(data);
          }
          
          // Fallback: data atual
          return new Date();
        } catch (error) {
          console.error('Erro ao processar data:', error);
          return new Date();
        }
      };
      
      // Se estamos forçando atualização ou não temos subscription no estado
      if (forceRefresh || !userSubscription) {
        const response = await getPlanoUsuario(userId);
        
        // Se está em modo de desenvolvimento e não tem plano cadastrado no backend
        if (DEV_MODE && (!response.success || !response.tem_plano)) {
          // Código de desenvolvimento existente...
        }
        
        if (response.success && response.tem_plano) {
          // Usar dados atuais da subscription do usuário
          const subscription = userData.subscription || {};
          
          const updatedSubscription = {
            planName: response.plano.nome,
            reportsLeft: subscription.reportsLeft || response.plano.relatorios_restantes,
            creditosPlano: subscription.creditosPlano || 0, // Novo campo
            endDate: processarData(response.plano.data_fim),
            startDate: processarData(response.plano.data_inicio),
            autoRenew: response.plano.renovacao_automatica,
          };
          
          setUserSubscription(updatedSubscription);
          setSubscriptionLoading(false);
          return updatedSubscription;
        }
      }
      
      // Usar os dados diretamente do Firestore se não conseguir do backend
      if (userData.subscription) {
        const subscriptionData = {
          planName: userData.subscription.planName || 'Plano',
          reportsLeft: userData.subscription.reportsLeft || 0,
          creditosPlano: userData.subscription.creditosPlano || 0,
          endDate: processarData(userData.subscription.endDate),
          startDate: processarData(userData.subscription.startDate),
          autoRenew: userData.subscription.autoRenew || false,
        };
        
        setUserSubscription(subscriptionData);
        setSubscriptionLoading(false);
        return subscriptionData;
      }
      
      setUserSubscription(null);
      setSubscriptionLoading(false);
      return null;
    } catch (error) {
      console.error('Erro ao carregar assinatura do usuário:', error);
      setSubscriptionLoading(false);
      return null;
    }
  };

  // Logout
  function logout() {
    setUserSubscription(null);
    return signOut(auth);
  }

  // Observer para mudanças no estado de autenticação
  useEffect(() => {
    console.log('[DEBUG AUTH] Inicializando observer de autenticação');
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('[DEBUG AUTH] Estado de autenticação alterado:', user ? `Usuário autenticado: ${user.uid}` : 'Usuário não autenticado');
      setCurrentUser(user);
      
      if (user) {
        // Carregar informações da assinatura quando o usuário fizer login
        loadUserSubscription(user.uid);
      }
      
      setLoading(false);
    });
    
    return unsubscribe;
  }, []);

  const refreshUserSubscription = async () => {
    if (currentUser) {
      console.log("[DEBUG AUTH] Forçando atualização dos dados de assinatura");
      return await loadUserSubscription(currentUser.uid, true);
    }
    return null;
  };

  const value = {
    refreshUserSubscription,
    currentUser,
    userSubscription,
    subscriptionLoading,
    register,
    login,
    loginWithGoogle,
    logout,
    saveUserData,
    updateUserData,
    updateUserSubscription,
    decrementReportsLeft,
    loadUserSubscription
  };

  // Adicionar log para depuração
  console.log('[DEBUG AUTH] Renderizando AuthProvider, loading:', loading, 'currentUser:', currentUser ? 'autenticado' : 'não autenticado');

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
} 