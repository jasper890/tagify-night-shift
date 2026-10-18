import { describe, expect, it } from 'vitest'
import { decodeResultCode, parseResultCode } from './resultCodes'

describe('Last Run Result decoder', () => {
  it('decodes the four slide 10 codes', () => {
    expect(decodeResultCode('0x0')?.name).toBe('Success')
    expect(decodeResultCode('0x1')?.name).toBe('Script error')
    expect(decodeResultCode('0x2')?.name).toBe('File not found')
    expect(decodeResultCode('0x41301')?.name).toBe('Still running')
  })

  it('accepts padded hex, decimal and negative HRESULT forms', () => {
    expect(decodeResultCode('0x00000002')?.code).toBe('0x2')
    expect(decodeResultCode('267009')?.code).toBe('0x41301')
    expect(decodeResultCode('-2147024891')?.code).toBe('0x80070005')
    expect(decodeResultCode('0X8004131f')?.code).toBe('0x8004131F')
  })

  it('returns null for unknown or invalid input', () => {
    expect(decodeResultCode('0x1234')).toBeNull()
    expect(parseResultCode('hello')).toBeNull()
    expect(parseResultCode('')).toBeNull()
  })
})
