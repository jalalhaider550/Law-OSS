import * as aes from 'aes-js'
import { createHash } from 'crypto'

function getKey(): Uint8Array {
  const secret = process.env.ENCRYPTION_SECRET!
  const hash = createHash('sha256').update(secret).digest()
  return new Uint8Array(hash)
}

export function encrypt(text: string): string {
  const key = getKey()
  const textBytes = aes.utils.utf8.toBytes(text)
  const aesCtr = new aes.ModeOfOperation.ctr(key)
  const encrypted = aesCtr.encrypt(textBytes)
  return aes.utils.hex.fromBytes(encrypted)
}

export function decrypt(encryptedHex: string): string {
  const key = getKey()
  const encryptedBytes = aes.utils.hex.toBytes(encryptedHex)
  const aesCtr = new aes.ModeOfOperation.ctr(key)
  const decrypted = aesCtr.decrypt(encryptedBytes)
  return aes.utils.utf8.fromBytes(decrypted)
}
