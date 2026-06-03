export function assetHash(input: string | Uint8Array) {
  return Bun.hash(input).toString(16).padStart(8, '0').slice(0, 8)
}
