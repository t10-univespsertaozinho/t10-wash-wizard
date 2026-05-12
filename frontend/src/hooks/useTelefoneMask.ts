import { useState, useCallback } from 'react';

export function useTelefoneMask(initialValue = '') {
  const [value, setValue] = useState(initialValue);

  const formatTelefone = useCallback((input: string): string => {
    const numeros = input.replace(/\D/g, '');
    
    if (numeros.length === 0) return '';
    if (numeros.length <= 2) return `(${numeros}`;
    if (numeros.length <= 7) return `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`;
    if (numeros.length <= 11) return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`;
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7, 11)}`;
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatTelefone(e.target.value);
    setValue(formatted);
  }, [formatTelefone]);

  return { value, setValue, handleChange, formatTelefone };
}