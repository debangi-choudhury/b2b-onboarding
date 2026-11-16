# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.1] - 2026-11-16

### Fixed

- Choosing a country on the Address step crashed the form ("Error rendering extension point"), because the selected value was read after React had reset the change event.

## [0.2.0] - 2026-11-12

### Changed

- The application form is a guided five-step flow: Company, Administrator, Address, Documents and Review. It has a progress stepper, a check per step, drag-and-drop document upload with a Replace option, a review step with Edit links, and "What happens next" and "Your application so far" panels beside the form.
- The receipt and the status page match the new look.

## [0.1.4] - 2026-11-12

### Removed

- The temporary diagnostic added in 0.1.1.

## [0.1.3] - 2026-11-12

### Changed

- Master Data calls, including document attachments, go to the account's own host, `{account}.vtexcommercestable.com.br`, which VTEX documents for the Master Data policy, instead of `api.vtex.com`.

## [0.1.1] and [0.1.2] - 2026-11-12

### Added

- A temporary, reviewer-only diagnostic for refused Master Data calls after installation. The refusals turned out to stop on their own about 15 minutes after the first install, once the app's permissions took effect.

## [0.1.0] - 2026-11-12

### Added

- Application form at `/business-application` for companies applying for a B2B account: company details, the future account administrator, the business address, and two documents (business registration certificate and tax certificate; PDF, JPG or PNG, up to 5 MB each).
- Receipt with a reference and a one-time status code, and a status page at `/business-application/status` that shows the current step, or the reason when an application is rejected.
- Review queue in Admin at `/admin/app/b2b-onboarding`, with filters for In review, Waiting for approval, Approved and Rejected, and a progress bar per application.
- Application page in Admin with a stage stepper, company and contact details, a document viewer, accept or reject per document, the eligibility check, and a full audit trail of who did what and when.
- Approval stages configurable in the app settings. The default is Document review, then Compliance check, then Final approval.
- Simulated eligibility check against a mock company registry, behind an interface a real provider can replace.
- Final approval creates the organization, its cost center and the administrator user through B2B Organizations, as its own Admin screen does, and sends its approval email.
- Reviewer access through the Buyer Organizations permissions in License Manager: View to read applications, Edit to act on them.
