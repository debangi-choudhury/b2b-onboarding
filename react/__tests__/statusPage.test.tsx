import React from 'react'
import { act, fireEvent, screen } from '@testing-library/react'
import { useRuntime } from 'vtex.render-runtime'

import Receipt from '../components/Receipt'
import StatusPage from '../StatusPage'
import { messages } from '../utils/messages'
import { jsonResponse, renderWithIntl, text } from './support/render'

const fetchMock = jest.fn()

beforeEach(() => {
  fetchMock.mockReset()
  global.fetch = fetchMock as never
  ;(useRuntime as jest.Mock).mockReturnValue({
    rootPath: '/us',
    query: { reference: 'APP-TEST0001' },
  })
})

const view = {
  reference: 'APP-TEST0001',
  companyName: 'TEST - Acme Industrial',
  status: 'IN_REVIEW',
  currentStageLabel: 'Compliance check',
  rejectionReason: null,
  submittedAt: '2026-11-20T10:00:00.000Z',
  decidedAt: null,
}

async function lookUp(code = 'CODE-123') {
  fireEvent.change(document.getElementById('b2b-onboarding-token') as Element, {
    target: { value: ` ${code} ` },
  })

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: text(messages.lookup) }))
  })
}

describe('StatusPage', () => {
  it('fills in the reference from the receipt link, never the code', () => {
    renderWithIntl(<StatusPage />)

    expect(
      (document.getElementById('b2b-onboarding-reference') as HTMLInputElement)
        .value
    ).toBe('APP-TEST0001')
    expect(
      (document.getElementById('b2b-onboarding-token') as HTMLInputElement)
        .value
    ).toBe('')
  })

  it('shows the current step, sending the code in the body only', async () => {
    fetchMock.mockReturnValue(jsonResponse(view))

    renderWithIntl(<StatusPage />)
    await lookUp()

    expect(screen.getByText(text(messages.IN_REVIEW))).toBeTruthy()
    // The result's details; the side panel names the stages too
    const details = document.querySelector('dl')?.textContent

    expect(details).toContain('Compliance check')
    expect(details).toContain('TEST - Acme Industrial')

    const [url, init] = fetchMock.mock.calls[0]

    expect(url).toBe('/us/_v/b2b-onboarding/status')
    expect(url).not.toContain('CODE-123')
    expect(JSON.parse(init.body)).toEqual({
      reference: 'APP-TEST0001',
      token: 'CODE-123',
    })
  })

  it('shows a rejection with its reason', async () => {
    fetchMock.mockReturnValue(
      jsonResponse({
        ...view,
        status: 'REJECTED',
        currentStageLabel: null,
        rejectionReason: 'Registration certificate has expired',
        decidedAt: '2026-11-22T10:00:00.000Z',
      })
    )

    renderWithIntl(<StatusPage />)
    await lookUp()

    expect(screen.getByText(text(messages.REJECTED))).toBeTruthy()
    expect(
      screen.getByText('Registration certificate has expired')
    ).toBeTruthy()
  })

  it.each([
    [404, messages.notFound],
    [429, messages.tooMany],
    [503, messages.failed],
  ])('explains a %s answer', async (status, message) => {
    fetchMock.mockReturnValue(jsonResponse({ code: 'X' }, status))

    renderWithIntl(<StatusPage />)
    await lookUp()

    expect(screen.getByRole('alert').textContent).toBe(text(message))
  })
})

describe('Receipt', () => {
  const receipt = {
    reference: 'APP-TEST0001',
    statusToken: 'CODE-123',
    submittedAt: '2026-11-25T10:00:00.000Z',
  }

  it('shows the reference and code, and links to the status page with the reference only', () => {
    renderWithIntl(<Receipt receipt={receipt} rootPath="/us" />)

    expect(screen.getByText('APP-TEST0001')).toBeTruthy()
    expect(screen.getByText('CODE-123')).toBeTruthy()

    const link = screen.getByRole('link', {
      name: new RegExp(text(messages.checkStatus)),
    })

    expect(link.getAttribute('href')).toBe(
      '/us/business-application/status?reference=APP-TEST0001'
    )
  })

  it('copies a value and says so for two seconds', async () => {
    jest.useFakeTimers()

    const writeText = jest.fn().mockResolvedValue(undefined)

    Object.assign(navigator, { clipboard: { writeText } })
    renderWithIntl(<Receipt receipt={receipt} rootPath="" />)

    const [copyReference] = screen.getAllByRole('button', {
      name: new RegExp(`^${text(messages.copy)}`),
    })

    await act(async () => {
      fireEvent.click(copyReference)
    })

    expect(writeText).toHaveBeenCalledWith('APP-TEST0001')
    expect(screen.getByText(text(messages.copied))).toBeTruthy()

    act(() => {
      jest.advanceTimersByTime(2000)
    })
    expect(screen.queryByText(text(messages.copied))).toBeNull()
    jest.useRealTimers()
  })

  it('stays quiet when copying is refused', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockRejectedValue(new Error('no')) },
    })
    renderWithIntl(<Receipt receipt={receipt} rootPath="" />)

    await act(async () => {
      fireEvent.click(
        screen.getAllByRole('button', {
          name: new RegExp(`^${text(messages.copy)}`),
        })[1]
      )
    })

    expect(screen.queryByText(text(messages.copied))).toBeNull()
  })
})
