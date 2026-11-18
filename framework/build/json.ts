// A parsed JSON value. Decoders narrow it with the guards below, never with casts.
export type Json = null | boolean | number | string | Json[] | JsonObject
export type JsonObject = { [key: string]: Json }

export function isText(value: Json | undefined): value is string {
  return typeof value === 'string'
}

export function isJsonObject(value: Json | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
