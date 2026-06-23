import { customAlphabet } from 'nanoid'

// URL-safe, lowercase — keeps generated routes tidy.
const nano = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 12)

export const newId = (prefix = '') => (prefix ? `${prefix}_${nano()}` : nano())
