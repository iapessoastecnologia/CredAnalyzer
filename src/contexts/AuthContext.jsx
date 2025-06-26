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

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Registro com email e senha
  async function register(email, password, userData) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // Salvar dados adicionais do usuário no Firestore
      await saveUserData(userCredential.user.uid, {
        ...userData,
        email: email
      });
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
  
  const updateUserSubscription = async (userId, subscriptionData) => {
    try {
      const userDocRef = doc(db, 'usuarios', userId);
      await updateDoc(userDocRef, { 
        subscription: subscriptionData 
      });
      return true;
    } catch (error) {
      console.error("Erro ao atualizar assinatura do usuário:", error);
      throw error;
    }
  };
  
  const decrementReportsLeft = async (userId) => {
    try {
      const userDocRef = doc(db, 'usuarios', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists() && userDoc.data().subscription?.reportsLeft > 0) {
        await updateDoc(userDocRef, {
          'subscription.reportsLeft': userDoc.data().subscription.reportsLeft - 1
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error("Erro ao decrementar relatórios restantes:", error);
      throw error;
    }
  };

  // Logout
  function logout() {
    return signOut(auth);
  }

  // Observer para mudanças no estado de autenticação
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    
    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    register,
    login,
    loginWithGoogle,
    logout,
    saveUserData,
    updateUserData,
    updateUserSubscription,
    decrementReportsLeft
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
} 