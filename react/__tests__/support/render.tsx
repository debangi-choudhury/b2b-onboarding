import React from 'react'
import { render } from '@testing-library/react'
import { IntlProvider } from 'react-intl'

const Intl = ({ children }: { children?: React.ReactNode }) => (
  <IntlProvider locale="en-US" timeZone="UTC" onError={() => {}}>
    {children}
  </IntlProvider>
)

/**
 * Renders with the messages' default English texts. A rerender keeps the
 * provider, so components update instead of mounting again.
 */
export function renderWithIntl(ui: React.ReactElement) {
  return render(ui, { wrapper: Intl })
}

/** The default English text of a message, with its values filled in */
export function text(
  message: { defaultMessage: string },
  values: Record<string, string | number> = {}
) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(String(value)),
    message.defaultMessage
  )
}

/** A fetch answer */
export function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  })
}
