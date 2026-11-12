import { DEFAULT_STAGES, resolveStages } from '../domain/stages'

describe('resolveStages', () => {
  it('uses the defaults when settings are empty', () => {
    for (const settings of [null, undefined, {}, { stages: [] }]) {
      expect(resolveStages(settings)).toEqual({
        stages: DEFAULT_STAGES,
        isDefault: true,
        problems: [],
      })
    }
  })

  it('accepts a valid custom list and makes IDs from labels', () => {
    const result = resolveStages({
      stages: [
        { label: 'Document review', type: 'REVIEW' },
        { label: 'Credit check', type: 'REVIEW', id: 'credit' },
        { label: 'Registry check', type: 'VERIFICATION' },
        { label: 'Sign-off', type: 'APPROVAL' },
      ],
    })

    expect(result.isDefault).toBe(false)
    expect(result.problems).toEqual([])
    expect(result.stages.map((s) => s.id)).toEqual([
      'document-review',
      'credit',
      'registry-check',
      'sign-off',
    ])
  })

  it('accepts a single approval stage', () => {
    const result = resolveStages({
      stages: [{ label: 'Approve', type: 'APPROVAL' }],
    })

    expect(result.isDefault).toBe(false)
  })

  it.each([
    ['no approval stage', [{ label: 'Review', type: 'REVIEW' }]],
    [
      'approval not last',
      [
        { label: 'Approve', type: 'APPROVAL' },
        { label: 'Review', type: 'REVIEW' },
      ],
    ],
    [
      'two approval stages',
      [
        { label: 'Approve', type: 'APPROVAL' },
        { label: 'Approve again', type: 'APPROVAL' },
      ],
    ],
    [
      'two verification stages',
      [
        { label: 'Check A', type: 'VERIFICATION' },
        { label: 'Check B', type: 'VERIFICATION' },
        { label: 'Approve', type: 'APPROVAL' },
      ],
    ],
    [
      'duplicate IDs',
      [
        { label: 'Review', type: 'REVIEW' },
        { label: 'Review', type: 'REVIEW' },
        { label: 'Approve', type: 'APPROVAL' },
      ],
    ],
    ['unknown type', [{ label: 'Approve', type: 'MAGIC' }]],
    ['missing label', [{ type: 'APPROVAL', id: 'x' }]],
    ['bad ID', [{ label: 'Approve', type: 'APPROVAL', id: 'Not Valid!' }]],
    [
      'too many stages',
      [
        ...Array.from({ length: 8 }, (_, i) => ({
          label: `Review ${i}`,
          type: 'REVIEW',
        })),
        { label: 'Approve', type: 'APPROVAL' },
      ],
    ],
  ])('falls back to the defaults on %s and reports why', (_, stages) => {
    const result = resolveStages({ stages })

    expect(result.isDefault).toBe(true)
    expect(result.stages).toEqual(DEFAULT_STAGES)
    expect(result.problems.length).toBeGreaterThan(0)
  })
})
