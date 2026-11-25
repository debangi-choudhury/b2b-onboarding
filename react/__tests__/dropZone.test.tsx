import React from 'react'
import { fireEvent, screen } from '@testing-library/react'

import { DropZone } from '../components/DropZone'
import { documentLabels, errorLabels, messages } from '../utils/messages'
import { renderWithIntl, text } from './support/render'

const pdf = new File(['%PDF-1.4'], 'registration.pdf', {
  type: 'application/pdf',
})

describe('DropZone', () => {
  it('takes a dropped file and shows that it is dragged over', () => {
    const onChange = jest.fn()

    renderWithIntl(
      <DropZone
        kind="REGISTRATION_CERTIFICATE"
        file={null}
        error={null}
        onChange={onChange}
      />
    )

    const zone = document.querySelector('label') as HTMLLabelElement

    fireEvent.dragOver(zone)
    expect(zone.className).toContain('dropZoneActive')

    fireEvent.dragLeave(zone)
    expect(zone.className).not.toContain('dropZoneActive')

    fireEvent.drop(zone, { dataTransfer: { files: [] } })
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.drop(zone, { dataTransfer: { files: [pdf] } })
    expect(onChange).toHaveBeenCalledWith(pdf)
  })

  it('shows the chosen file, and Replace opens the file picker', () => {
    renderWithIntl(
      <DropZone
        kind="TAX_CERTIFICATE"
        file={pdf}
        error={null}
        onChange={jest.fn()}
      />
    )

    const picker = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement

    const click = jest.spyOn(picker, 'click')

    expect(screen.getByText('registration.pdf')).toBeTruthy()
    fireEvent.click(
      screen.getByRole('button', {
        name: `${text(messages.replace)}: ${text(
          documentLabels.TAX_CERTIFICATE
        )}`,
      })
    )
    expect(click).toHaveBeenCalled()
  })

  it('describes the input with its error', () => {
    renderWithIntl(
      <DropZone
        kind="TAX_CERTIFICATE"
        file={null}
        error="TOO_LARGE"
        onChange={jest.fn()}
      />
    )

    const picker = document.querySelector('input[type="file"]') as Element

    expect(picker.getAttribute('aria-invalid')).toBe('true')
    expect(
      document.getElementById(picker.getAttribute('aria-describedby') as string)
        ?.textContent
    ).toBe(text(errorLabels.TOO_LARGE))
  })
})
