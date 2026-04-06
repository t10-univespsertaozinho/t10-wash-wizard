const STORAGE_SECRET = import.meta.env.VITE_STORAGE_SECRET || 't10-wizard-default-secret-2024';

function base64Encode(str: string): string {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch {
    return btoa(str);
  }
}

function base64Decode(str: string): string {
  try {
    return decodeURIComponent(escape(atob(str)));
  } catch {
    return atob(str);
  }
}

export function computeHMAC(data: string): string {
  const key = STORAGE_SECRET.split('').reverse().join('');
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const combined = `${hash}-${data}-${key}`;
  let result = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    result = ((result << 5) - result) + char;
    result = result & result;
  }
  return Math.abs(result).toString(36);
}

export interface SignedUser {
  id: string;
  nome: string;
  email: string;
  role: 'admin' | 'user';
  _signature: string;
  _timestamp: number;
}

export function createSignedUser(user: Omit<SignedUser, '_signature' | '_timestamp'>): SignedUser {
  const data = `${user.id}|${user.nome}|${user.email}|${user.role}`;
  return {
    ...user,
    _signature: computeHMAC(data),
    _timestamp: Date.now(),
  };
}

export function verifySignedUser(user: SignedUser | null): SignedUser | null {
  if (!user) return null;
  
  const data = `${user.id}|${user.nome}|${user.email}|${user.role}`;
  const expectedSignature = computeHMAC(data);
  
  if (user._signature !== expectedSignature) {
    return null;
  }
  
  const maxAge = 30 * 24 * 60 * 60 * 1000;
  if (Date.now() - user._timestamp > maxAge) {
    return null;
  }
  
  return user;
}

export function encryptStorage(data: string): string {
  const encoded = base64Encode(data);
  const hash = computeHMAC(encoded);
  return base64Encode(`${hash}|${encoded}`);
}

export function decryptStorage(encrypted: string): string | null {
  try {
    const decoded = base64Decode(encrypted);
    const parts = decoded.split('|');
    if (parts.length < 2) return null;
    
    const hash = parts[0];
    const data = parts.slice(1).join('|');
    const expectedHash = computeHMAC(data);
    
    if (hash !== expectedHash) {
      return null;
    }
    
    return base64Decode(data);
  } catch {
    return null;
  }
}

export function sanitizeInput(input: string): string {
  if (!input) return '';
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 11;
}