import React from 'react'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { useRuntime } from 'vtex.render-runtime'

import ApplyPage from '../ApplyPage'
import { fieldId } from '../components/Fields'
import {
  documentLabels,
  errorLabels,
  fieldLabels,
  messages,
} from '../utils/messages'
import { jsonResponse, renderWithIntl, text } from './support/render'

const fetchMock = jest.fn()

beforeEach(() => {
  fetchMock.mockReset()
  global.fetch = fetchMock as never
  ;(useRuntime as jest.Mock).mockReturnValue({ rootPath: '/us/', query: {} })
  window.scrollTo = jest.fn()
})

const input = (name: string) =>
  document.getElementById(fieldId(name)) as HTMLInputElement

function fill(values: Record<string, string>) {
  for (const [name, value] of Object.entries(values)) {
    fireEvent.change(input(name), { target: { value } })
    fireEvent.blur(input(name))
  }
}

// The step's own heading; the side panels have headings too
const heading = () => document.querySelector('form h2')?.textContent

const continueButton = () =>
  screen.getByRole('button', {
    name: new RegExp(
      `^(${text(messages.continue)}|${text(messages.continueReview)}|${text(
        messages.submit
      )})$`
    ),
  })

function next() {
  fireEvent.click(continueButton())
}

const pdf = new File(['%PDF-1.4'], 'registration.pdf', {
  type: 'application/pdf',
})

const png = new File([new Uint8Array(2048)], 'tax.png', { type: 'image/png' })

function attachDocuments() {
  const inputs = document.querySelectorAll('input[type="file"]')

  fireEvent.change(inputs[0], { target: { files: [pdf] } })
  fireEvent.change(inputs[1], { target: { files: [png] } })
}

const COMPANY = {
  companyName: 'TEST - Acme Industrial',
  registrationNumber: 'US-123456',
}

const CONTACT = {
  'contact.firstName': 'Test',
  'contact.lastName': 'Applicant',
  'contact.email': 'applicant@example.com',
}

const ADDRESS = {
  'address.street': 'TEST Demo Street',
  'address.city': 'New York',
  'address.state': 'NY',
  'address.postalCode': '10001',
}

/** Fills every step of a United States application up to Review */
function toReview() {
  fill(COMPANY)
  next()
  fill(CONTACT)
  next()
  fill(ADDRESS)
  next()
  attachDocuments()
  next()
}

const sentForm = () => fetchMock.mock.calls[0][1].body as FormData

describe('ApplyPage, United States', () => {
  it('starts on the Company step of five', () => {
    renderWithIntl(<ApplyPage />)

    expect(heading()).toBe(text(messages.companyTitle))
    expect(
      screen.getByText(text(messages.stepOf, { current: 1, total: 5 }))
    ).toBeTruthy()
    expect(screen.queryByText(text(messages.back))).toBeNull()
    expect(screen.queryByText(text(messages.indiaTitle))).toBeNull()
    expect(screen.getByText(text(messages.summaryEmpty))).toBeTruthy()
  })

  it('marks missing fields and stays on the step', () => {
    renderWithIntl(<ApplyPage />)

    next()

    expect(screen.getByRole('alert').textContent).toBe(text(messages.fixErrors))
    expect(input('companyName').getAttribute('aria-invalid')).toBe('true')
    expect(
      screen.getAllByText(text(errorLabels.REQUIRED)).length
    ).toBeGreaterThanOrEqual(2)
    expect(heading()).toBe(text(messages.companyTitle))
  })

  it('checks a field when leaving it, and clears the error once fixed', () => {
    renderWithIntl(<ApplyPage />)

    fill({ companyName: 'A' })
    expect(input('companyName').getAttribute('aria-invalid')).toBe('true')

    fill({ companyName: 'TEST - Acme' })
    expect(input('companyName').getAttribute('aria-invalid')).toBe('false')
  })

  it('walks through every step, keeps answers on Back, and submits the form', async () => {
    fetchMock.mockReturnValue(
      jsonResponse(
        {
          reference: 'APP-TEST0001',
          statusToken: 'CODE-123',
          submittedAt: '2026-11-25T10:00:00.000Z',
        },
        201
      )
    )

    renderWithIntl(<ApplyPage />)

    fill(COMPANY)
    next()
    expect(heading()).toBe(text(messages.adminTitle))

    fireEvent.click(screen.getByText(text(messages.back)))
    expect(input('companyName').value).toBe(COMPANY.companyName)
    next()

    fill(CONTACT)
    next()
    expect(heading()).toBe(text(messages.addressTitle))
    expect(
      screen.getByText(
        new RegExp(
          text(messages.countryOnCompanyStep, { country: 'United States' })
        )
      )
    ).toBeTruthy()

    fill(ADDRESS)
    next()
    expect(heading()).toBe(text(messages.documentsTitle))

    // No documents yet
    next()
    expect(screen.getAllByText(text(errorLabels.MISSING))).toHaveLength(2)

    attachDocuments()
    expect(screen.getByText(/registration\.pdf/)).toBeTruthy()
    next()

    expect(heading()).toBe(text(messages.reviewTitle))
    // In the review and in the side summary
    expect(screen.getAllByText('TEST - Acme Industrial')).toHaveLength(2)
    expect(screen.getByText('United States')).toBeTruthy()
    expect(screen.getByText('tax.png · 2 KB')).toBeTruthy()
    expect(screen.getByText('New York, NY, 10001, USA')).toBeTruthy()
    // The side panel follows the answers
    expect(screen.getByText('Test Applicant')).toBeTruthy()

    await act(async () => {
      next()
    })

    expect(await screen.findByText(text(messages.successTitle))).toBeTruthy()
    expect(screen.getByText('APP-TEST0001')).toBeTruthy()

    const [url, init] = fetchMock.mock.calls[0]

    expect(url).toBe('/us/_v/b2b-onboarding/apply')
    expect(init).toMatchObject({ method: 'POST', credentials: 'omit' })

    const form = sentForm()

    expect(form.get('companyName')).toBe('TEST - Acme Industrial')
    expect(form.get('contact.email')).toBe('applicant@example.com')
    expect(form.get('address.country')).toBe('USA')
    expect(form.get('website')).toBe('')
    expect((form.get('REGISTRATION_CERTIFICATE') as File).name).toBe(
      'registration.pdf'
    )
    // No India fields for other countries
    expect(form.has('india.pan')).toBe(false)
    expect(form.has('india.importsOrExports')).toBe(false)
  })

  it('goes back to a step from the review and from the stepper', () => {
    renderWithIntl(<ApplyPage />)

    toReview()

    fireEvent.click(
      screen.getByRole('button', {
        name: `${text(messages.edit)}: ${text(messages.stepAddress)}`,
      })
    )
    expect(heading()).toBe(text(messages.addressTitle))

    fireEvent.click(screen.getByText(text(messages.changeCountry)))
    expect(heading()).toBe(text(messages.companyTitle))

    // Steps already reached stay open in the stepper
    fireEvent.click(
      screen.getByRole('button', {
        name: new RegExp(text(messages.stepReview)),
      })
    )
    expect(heading()).toBe(text(messages.reviewTitle))
  })

  it('replaces a document', () => {
    renderWithIntl(<ApplyPage />)

    fill(COMPANY)
    next()
    fill(CONTACT)
    next()
    fill(ADDRESS)
    next()
    attachDocuments()

    const replace = screen.getByRole('button', {
      name: `${text(messages.replace)}: ${text(
        documentLabels.REGISTRATION_CERTIFICATE
      )}`,
    })

    expect(replace).toBeTruthy()

    const empty = new File([], 'empty.pdf', { type: 'application/pdf' })
    const [first] = Array.from(document.querySelectorAll('input[type="file"]'))

    fireEvent.change(first, { target: { files: [empty] } })
    expect(screen.getByText(text(errorLabels.EMPTY))).toBeTruthy()

    const dropZone = screen
      .getAllByText(new RegExp(text(messages.dropHere)))[0]
      .closest('div') as HTMLElement

    fireEvent.dragOver(dropZone)
    fireEvent.dragLeave(dropZone)
    fireEvent.drop(dropZone, { dataTransfer: { files: [pdf] } })
  })

  it.each([
    [429, messages.tooMany],
    [413, messages.tooLargeRequest],
    [500, messages.failed],
  ])('explains a %s answer', async (status, message) => {
    fetchMock.mockReturnValue(jsonResponse({ code: 'X' }, status))

    renderWithIntl(<ApplyPage />)
    toReview()

    await act(async () => {
      next()
    })

    expect((await screen.findByRole('alert')).textContent).toBe(text(message))
    expect(heading()).toBe(text(messages.reviewTitle))
  })

  it('explains a network failure', async () => {
    fetchMock.mockReturnValue(Promise.reject(new Error('offline')))

    renderWithIntl(<ApplyPage />)
    toReview()

    await act(async () => {
      next()
    })

    expect((await screen.findByRole('alert')).textContent).toBe(
      text(messages.failed)
    )
  })

  it('takes the applicant to the field the server refused', async () => {
    fetchMock.mockReturnValue(
      jsonResponse(
        {
          code: 'INVALID_FIELDS',
          fields: [{ field: 'contact.email', code: 'INVALID_FORMAT' }],
        },
        400
      )
    )

    renderWithIntl(<ApplyPage />)
    toReview()

    await act(async () => {
      next()
    })

    await waitFor(() => expect(heading()).toBe(text(messages.adminTitle)))
    expect(screen.getByText(text(errorLabels.INVALID_FORMAT))).toBeTruthy()
  })
})

describe('ApplyPage, India', () => {
  function chooseIndia() {
    fireEvent.change(input('address.country'), { target: { value: 'IND' } })
  }

  const INDIA_COMPANY = {
    ...COMPANY,
    companyName: 'TEST - KYC Demo Pvt Ltd',
    'india.pan': 'ABCCK1234F',
  }

  const BANK = {
    'india.accountNumber': '123456789012',
    'india.ifsc': 'HDFC0001234',
    'india.accountHolderName': 'TEST - KYC Demo Pvt Ltd',
  }

  it('adds the India identifiers and a Bank account step', () => {
    renderWithIntl(<ApplyPage />)

    chooseIndia()

    expect(screen.getByText(text(messages.indiaTitle))).toBeTruthy()
    expect(
      screen.getByText(text(messages.stepOf, { current: 1, total: 6 }))
    ).toBeTruthy()
    // IEC only after "Yes" to import or export
    expect(input('india.iec')).toBeNull()
    fireEvent.change(input('india.importsOrExports'), {
      target: { value: 'yes' },
    })
    expect(input('india.iec')).toBeTruthy()
  })

  it("refuses an individual's PAN", () => {
    renderWithIntl(<ApplyPage />)

    chooseIndia()
    fill({ 'india.pan': 'ABCPE1234F' })

    expect(screen.getByText(text(errorLabels.PAN_NOT_BUSINESS))).toBeTruthy()
  })

  it('sends the India identifiers, the bank account and the import answer', async () => {
    fetchMock.mockReturnValue(
      jsonResponse(
        { reference: 'APP-TEST0002', statusToken: 'C', submittedAt: '' },
        201
      )
    )

    renderWithIntl(<ApplyPage />)

    chooseIndia()
    fill(INDIA_COMPANY)
    fireEvent.change(input('india.importsOrExports'), {
      target: { value: 'yes' },
    })
    fill({ 'india.iec': '0512345678' })
    next()

    expect(heading()).toBe(text(messages.bankTitle))
    next()
    expect(input('india.accountNumber').getAttribute('aria-invalid')).toBe(
      'true'
    )
    fill(BANK)
    next()
    fill(CONTACT)
    next()
    fill(ADDRESS)
    next()
    attachDocuments()
    next()

    expect(heading()).toBe(text(messages.reviewTitle))
    expect(screen.getByText('0512345678')).toBeTruthy()

    await act(async () => {
      next()
    })
    await screen.findByText('APP-TEST0002')

    const form = sentForm()

    expect(form.get('india.pan')).toBe('ABCCK1234F')
    expect(form.get('india.iec')).toBe('0512345678')
    expect(form.get('india.importsOrExports')).toBe('yes')
    expect(form.get('india.accountNumber')).toBe('123456789012')
    expect(form.get('address.country')).toBe('IND')
  })

  it('leaves the IEC out when the business does not import or export', async () => {
    fetchMock.mockReturnValue(
      jsonResponse(
        { reference: 'APP-X', statusToken: 'C', submittedAt: '' },
        201
      )
    )

    renderWithIntl(<ApplyPage />)

    chooseIndia()
    fill(INDIA_COMPANY)
    next()
    fill(BANK)
    next()
    fill(CONTACT)
    next()
    fill(ADDRESS)
    next()
    attachDocuments()
    next()

    await act(async () => {
      next()
    })
    await screen.findByText('APP-X')

    expect(sentForm().has('india.iec')).toBe(false)
    expect(sentForm().get('india.importsOrExports')).toBe('no')
  })

  it('makes the applicant walk the steps again after switching to India', () => {
    renderWithIntl(<ApplyPage />)

    toReview()
    fireEvent.click(
      screen.getByRole('button', {
        name: `${text(messages.edit)}: ${text(messages.stepCompany)}`,
      })
    )
    chooseIndia()

    // The Review step is no longer reachable from the stepper
    expect(
      screen.queryByRole('button', {
        name: new RegExp(text(messages.stepReview)),
      })
    ).toBeNull()
    expect(screen.getByText(text(fieldLabels['india.pan']))).toBeTruthy()
  })
})
