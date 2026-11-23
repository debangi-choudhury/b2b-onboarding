import {
  matchNames,
  nameSimilarity,
  nameWords,
  PARTIAL_MATCH,
  STRONG_MATCH,
  worseStatus,
} from '../domain/nameMatch'

describe('nameWords', () => {
  it('uppercases, splits on punctuation and drops company-type words', () => {
    expect(nameWords('TEST - KYC Demo Pvt. Ltd.')).toEqual(['KYC', 'DEMO'])
    expect(nameWords('Acme Private Limited')).toEqual(['ACME'])
    expect(nameWords('Acme & Co LLP')).toEqual(['ACME'])
    expect(nameWords('Shree-Ram Traders (Company)')).toEqual([
      'SHREE',
      'RAM',
      'TRADERS',
    ])
  })

  it('counts a repeated word once', () => {
    expect(nameWords('Demo Demo Traders')).toEqual(['DEMO', 'TRADERS'])
  })
})

describe('nameSimilarity', () => {
  it('is 1 for the same words in any order or case, with any suffix', () => {
    expect(
      nameSimilarity('TEST - KYC Demo Pvt Ltd', 'KYC DEMO PRIVATE LIMITED')
    ).toBe(1)
    expect(nameSimilarity('Demo KYC', 'kyc demo')).toBe(1)
  })

  it('is 0 when no words are shared, or a name has no words left', () => {
    expect(nameSimilarity('Acme Traders', 'Globex Industries')).toBe(0)
    expect(nameSimilarity('Pvt Ltd', 'Pvt Ltd')).toBe(0)
    expect(nameSimilarity('', 'Acme')).toBe(0)
  })

  it('counts shared words: 2 of 2 against 2 of 3 is 0.8', () => {
    expect(nameSimilarity('KYC Demo', 'KYC Demo Enterprises')).toBeCloseTo(0.8)
  })
})

describe('matchNames', () => {
  const band = (a: string, b: string) => matchNames(a, b).band

  it('calls the same name with another suffix a strong match', () => {
    expect(band('TEST - KYC Demo Pvt Ltd', 'TEST - KYC DEMO LIMITED')).toBe(
      'STRONG'
    )
  })

  it("calls the mock bank's changed name a partial match", () => {
    // What MockKycProvider returns for an account ending in 7
    expect(
      band('TEST - KYC Demo Pvt Ltd', 'TEST - KYC DEMO PVT ENTERPRISES')
    ).toBe('PARTIAL')
    expect(band('TEST - KYC Demo', 'TEST - KYC ENTERPRISES')).toBe('PARTIAL')
  })

  it('calls a different business no match', () => {
    expect(band('TEST - KYC Demo Pvt Ltd', 'Someone Else Traders')).toBe('NONE')
  })

  it('rounds the score to 2 decimals and keeps both names', () => {
    expect(matchNames('A B C', 'A B D')).toEqual({
      comparedWith: 'A B C',
      registeredName: 'A B D',
      score: 0.67,
      band: 'PARTIAL',
    })
  })

  it('keeps the thresholds where the bands above rely on them', () => {
    expect(STRONG_MATCH).toBe(0.85)
    expect(PARTIAL_MATCH).toBe(0.5)
    expect(band('A B', 'A C')).toBe('PARTIAL') // exactly 0.5
  })
})

describe('worseStatus', () => {
  it('ranks FAILED, then MANUAL_REVIEW, then VERIFIED', () => {
    expect(worseStatus('VERIFIED', 'MANUAL_REVIEW')).toBe('MANUAL_REVIEW')
    expect(worseStatus('FAILED', 'MANUAL_REVIEW')).toBe('FAILED')
    expect(worseStatus('VERIFIED', 'VERIFIED')).toBe('VERIFIED')
  })
})
