import { useState } from 'react';

/**
 * Aplica máscara para telefone no formato (XX) XXXXX-XXXX
 * @param {string} value - Valor do telefone a ser formatado
 * @returns {string} Valor formatado
 */
export const maskPhone = (value) => {
  if (!value) return '';
  
  // Remove todos os caracteres que não são dígitos
  const cleanedValue = value.replace(/\D/g, '');
  
  // Aplica a máscara de acordo com o tamanho
  if (cleanedValue.length <= 2) {
    return cleanedValue.length ? `(${cleanedValue}` : '';
  } else if (cleanedValue.length <= 7) {
    return `(${cleanedValue.slice(0, 2)}) ${cleanedValue.slice(2)}`;
  } else if (cleanedValue.length <= 11) {
    return `(${cleanedValue.slice(0, 2)}) ${cleanedValue.slice(2, 7)}-${cleanedValue.slice(7, 11)}`;
  } else {
    // Limita a 11 dígitos (DDD + 9 dígitos)
    return `(${cleanedValue.slice(0, 2)}) ${cleanedValue.slice(2, 7)}-${cleanedValue.slice(7, 11)}`;
  }
};

/**
 * Hook de input controlado com máscara para telefone
 * @param {string} initialValue - Valor inicial 
 * @returns {Array} [value, setValue, handleChange]
 */
export const usePhoneMask = (initialValue = '') => {
  const [value, setValue] = useState(maskPhone(initialValue));
  
  const handleChange = (e) => {
    const maskedValue = maskPhone(e.target.value);
    setValue(maskedValue);
  };
  
  return [value, setValue, handleChange];
}; 