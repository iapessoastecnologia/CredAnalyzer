import { loadStripe } from '@stripe/stripe-js';

// Carrega a chave publicável do arquivo .env
const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

// Inicializa a Promise do Stripe com a chave publicável
const stripePromise = loadStripe(stripePublishableKey);

export default stripePromise; 