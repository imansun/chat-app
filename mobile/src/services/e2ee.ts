import { Buffer } from 'buffer';
import * as SecureStore from 'expo-secure-store';
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';
import { keyApi } from './api';

const PRIVATE_KEY_KEY = 'e2ee_private_key';
const PUBLIC_KEY_KEY = 'e2ee_public_key';

export interface KeyPair {
  publicKey: string;
  secretKey: string;
}

export async function generateKeyPair(): Promise<KeyPair> {
  const pair = nacl.box.keyPair();
  return {
    publicKey: encodeBase64(pair.publicKey),
    secretKey: encodeBase64(pair.secretKey),
  };
}

export async function storeKeyPair(keys: KeyPair): Promise<void> {
  await SecureStore.setItemAsync(PRIVATE_KEY_KEY, keys.secretKey);
  await SecureStore.setItemAsync(PUBLIC_KEY_KEY, keys.publicKey);
}

export async function getKeyPair(): Promise<KeyPair | null> {
  const secretKey = await SecureStore.getItemAsync(PRIVATE_KEY_KEY);
  const publicKey = await SecureStore.getItemAsync(PUBLIC_KEY_KEY);
  if (!secretKey || !publicKey) return null;
  return { publicKey, secretKey };
}

export async function hasKeys(): Promise<boolean> {
  const kp = await getKeyPair();
  return kp !== null;
}

export async function ensureKeys(userId: number): Promise<void> {
  const kp = await getKeyPair();
  if (kp) return;

  const newKeys = await generateKeyPair();
  await storeKeyPair(newKeys);

  try {
    await keyApi.upload(newKeys.publicKey);
  } catch {
    // server may reject duplicate key; ignore
  }
}

export async function encryptMessage(
  text: string,
  recipientId: number,
  senderKeyPair: KeyPair,
): Promise<string | null> {
  try {
    const { data: recipientPublicKey } = await keyApi.get(recipientId);
    const recipientPub = decodeBase64(recipientPublicKey);
    const senderSec = decodeBase64(senderKeyPair.secretKey);

    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const messageBytes = decodeUTF8(text);
    const encrypted = nacl.box(messageBytes, nonce, recipientPub, senderSec);

    if (!encrypted) return null;

    const combined = new Uint8Array(nonce.length + encrypted.length);
    combined.set(nonce);
    combined.set(encrypted, nonce.length);

    return encodeBase64(combined);
  } catch {
    return null;
  }
}

export async function decryptMessage(
  encryptedBase64: string,
  senderId: number,
  recipientKeyPair: KeyPair,
): Promise<string | null> {
  try {
    const { data: senderPublicKey } = await keyApi.get(senderId);
    const senderPub = decodeBase64(senderPublicKey);
    const recipientSec = decodeBase64(recipientKeyPair.secretKey);

    const combined = decodeBase64(encryptedBase64);
    const nonce = combined.slice(0, nacl.box.nonceLength);
    const ciphertext = combined.slice(nacl.box.nonceLength);

    const decrypted = nacl.box.open(ciphertext, nonce, senderPub, recipientSec);
    if (!decrypted) return null;

    return encodeUTF8(decrypted);
  } catch {
    return null;
  }
}
