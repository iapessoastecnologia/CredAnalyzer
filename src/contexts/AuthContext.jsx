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
      let creditosExistentes = 0;
      let planoAnterior = null;
      
      try {
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // Verificar se o usuário já tem créditos
          if (userData.creditosRestantes && userData.creditosRestantes > 0) {
            creditosExistentes = userData.creditosRestantes;
            console.log('[DEBUG AUTH] Usuário possui créditos existentes:', creditosExistentes);
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
      
      // Atualizar a quantidade de relatórios disponíveis somando os existentes
      if (!subscriptionData.preserveCredits) { // Se não for especificado para preservar os créditos existentes
        subscriptionData.reportsLeft = (subscriptionData.reportsLeft || 0) + creditosExistentes;
      }
      
      // Registrar o plano anterior
      if (planoAnterior && !subscriptionData.previousPlan) {
        subscriptionData.previousPlan = planoAnterior;
      }
      
      await updateDoc(userDocRef, { 
        subscription: subscriptionData,
        creditosRestantes: subscriptionData.reportsLeft,
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
  const loadUserSubscription = async (userId) => {
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
      
      const response = await getPlanoUsuario(userId);
      
      // Se está em modo de desenvolvimento e não tem plano cadastrado no backend
      if (DEV_MODE && (!response.success || !response.tem_plano)) {
        // Verificar se temos dados mockados no localStorage
        const mockUserDataJson = localStorage.getItem('mock_user_data_' + userId);
        
        if (mockUserDataJson) {
          const mockUserData = JSON.parse(mockUserDataJson);
          
          if (mockUserData.temPlano && mockUserData.plano) {
            const subscription = {
              planName: mockUserData.plano.nome,
              reportsLeft: mockUserData.plano.relatorios_restantes,
              endDate: new Date(mockUserData.plano.data_fim),
              autoRenew: mockUserData.plano.renovacao_automatica,
            };
            
            setUserSubscription(subscription);
            
            // Também atualizar o documento do usuário para consistência
            await updateDoc(doc(db, "usuarios", userId), {
              creditosRestantes: mockUserData.plano.relatorios_restantes,
              temPlano: true
            });
            
            return subscription;
          }
        }
      }
      
      if (response.success && response.tem_plano) {
        // Usar creditosRestantes do documento do usuário para maior precisão
        const subscription = {
          planName: response.plano.nome,
          reportsLeft: userData.creditosRestantes || response.plano.relatorios_restantes,
          endDate: new Date(response.plano.data_fim),
          autoRenew: response.plano.renovacao_automatica,
        };
        
        setUserSubscription(subscription);
        return subscription;
      } else {
        setUserSubscription(null);
        return null;
      }
    } catch (error) {
      console.error("Erro ao carregar assinatura:", error);
      setUserSubscription(null);
      return null;
    } finally {
      setSubscriptionLoading(false);
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

  const value = {
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