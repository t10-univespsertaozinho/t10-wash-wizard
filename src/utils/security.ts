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

async function getCryptoKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(STORAGE_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  return keyMaterial;
}

export async function computeHMAC(data: string): Promise<string> {
  try {
    const key = await getCryptoKey();
    const enc = new TextEncoder();
    const signature = await crypto.subtle.sign("HMAC", key, enc.encode(data));
    const hashArray = Array.from(new Uint8Array(signature));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return 'invalid-hash';
  }
}

export interface SignedUser {
  id: string;
  nome: string;
  email: string;
  role: 'admin' | 'user';
  _signature: string;
  _timestamp: number;
}

export async function createSignedUser(user: Omit<SignedUser, '_signature' | '_timestamp'>): Promise<SignedUser> {
  const data = `${user.id}|${user.nome}|${user.email}|${user.role}`;
  return {
    ...user,
    _signature: await computeHMAC(data),
    _timestamp: Date.now(),
  };
}

export async function verifySignedUser(user: SignedUser | null): Promise<SignedUser | null> {
  if (!user) return null;
  
  const data = `${user.id}|${user.nome}|${user.email}|${user.role}`;
  const expectedSignature = await computeHMAC(data);
  
  if (user._signature !== expectedSignature) {
    return null;
  }
  
  const maxAge = 30 * 24 * 60 * 60 * 1000;
  if (Date.now() - user._timestamp > maxAge) {
    return null;
  }
  
  return user;
}

export async function encryptStorage(data: string): Promise<string> {
  const encoded = base64Encode(data);
  const hash = await computeHMAC(encoded);
  return base64Encode(`${hash}|${encoded}`);
}

export async function decryptStorage(encrypted: string): Promise<string | null> {
  try {
    const decoded = base64Decode(encrypted);
    const parts = decoded.split('|');
    if (parts.length < 2) return null;
    
    const hash = parts[0];
    const data = parts.slice(1).join('|');
    const expectedHash = await computeHMAC(data);
    
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