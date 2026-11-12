import type { Application } from './types'

/**
 * Maps an approved application to B2B Organizations' OrganizationInput, as
 * the native request form would fill it in.
 */
export function toOrganizationInput(app: Application) {
  const { address, contact } = app

  return {
    name: app.companyName,
    tradeName: app.tradeName || undefined,
    b2bCustomerAdmin: {
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
    },
    defaultCostCenter: {
      name: `${app.companyName} HQ`.slice(0, 100),
      phoneNumber: contact.phone || undefined,
      businessDocument: app.taxId || app.registrationNumber,
      address: {
        addressType: 'commercial',
        receiverName:
          address.receiverName || `${contact.firstName} ${contact.lastName}`,
        street: address.street,
        number: address.number || undefined,
        complement: address.complement || undefined,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country,
      },
    },
  }
}
