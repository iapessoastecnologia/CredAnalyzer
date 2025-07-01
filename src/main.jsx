import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './styles/shared-buttons.css'
import { AuthProvider } from './contexts/AuthContext'

// Log para depuração
console.log('[DEBUG MAIN] Inicializando aplicação e AuthProvider');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)
