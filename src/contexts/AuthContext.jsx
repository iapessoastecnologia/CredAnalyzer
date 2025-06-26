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
import { criarCliente, getPlanoUsuario, consumirRelatorio } from '../services/paymentService';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
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
        email: email
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
          isProfileComplete: false
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
      await updateDoc(userDocRef, { 
        subscription: subscriptionData 
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
      // Usar a API para consumir um relatório
      const response = await consumirRelatorio(userId);
      
      if (response.success) {
        // Atualizar o estado local
        if (userSubscription) {
          setUserSubscription({
            ...userSubscription,
            reportsLeft: userSubscription.reportsLeft - 1
          });
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error("Erro ao decrementar relatórios restantes:", error);
      throw error;
    }
  };
  
  // Carregar informações da assinatura do usuário
  const loadUserSubscription = async (userId) => {
    if (!userId) return null;
    
    setSubscriptionLoading(true);
    try {
      const response = await getPlanoUsuario(userId);
      
      if (response.success && response.tem_plano) {
        const subscription = {
          planName: response.plano.nome,
          reportsLeft: response.plano.relatorios_restantes,
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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
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

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
} 