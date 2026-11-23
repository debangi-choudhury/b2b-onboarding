# B2B Onboarding

Adds a verified onboarding flow to B2B stores. Companies apply through a form with their documents, reviewers take each application through configurable stages in Admin, and final approval creates the organization in [B2B Organizations](https://developers.vtex.com/docs/apps/vtex.b2b-organizations).

B2B Organizations' own request form takes a company name and address, and an admin approves or declines it in one step. This app adds document upload, an eligibility check, staged review with per-document decisions, and an audit trail.

## Requirements

- B2B Organizations 3.x with `vtex.b2b-organizations-graphql` 2.x.
- Reviewers need the **Buyer Organizations** permissions in License Manager (product 97): **Buyer Organization View** to see applications and documents, **Buyer Organization Edit** to act on them. Approving also uses the reviewer's own rights in B2B Organizations.
- No theme change. The app adds its own store pages. To send the theme's existing signup link to the new form, add a store redirect from `/organization-request` to `/business-application`.

## For applicants

`/business-application` asks for:

- **Company:** legal name, trade name, registration number and tax ID.
- **Account administrator:** first and last name, email and phone. This person becomes the organization's administrator and receives the approval email.
- **Business address.**
- **Documents:** business registration certificate and tax certificate. PDF, JPG or PNG, up to 5 MB each.

After submitting, the applicant gets a reference and a status code, shown once. `/business-application/status` uses both to show the current step, or the reason when the application is rejected.

## For reviewers

**Admin > B2B onboarding** (`/admin/app/b2b-onboarding`) lists applications, newest first, with filters for In review, Waiting for approval, Approved and Rejected.

Each application shows its stages, details, documents, eligibility check and audit trail. The actions depend on the current stage:

| Stage type | What the reviewer does | Can pass when |
| --- | --- | --- |
| Review | Views each document and accepts or rejects it, with an optional note | Every document is accepted |
| Verification | Runs the eligibility check | The check passed |
| Approval | Approves | Always. Approval creates the organization, its cost center and the administrator user in B2B Organizations, and sends the approval email |

An application can be rejected at any stage. The reason is shown to the applicant. Notes are internal.

## Settings

**Approval stages** lists the stages each new application goes through, in order. Each stage has a label, an optional ID and a type: Review, Verification or Approval. Use exactly one Approval stage, as the last stage, and at most one Verification stage.

With no stages set, or with invalid settings, the default applies: Document review, then Compliance check, then Final approval. Applications already submitted keep the stages they started with.

## Eligibility check

This version uses a simulated company registry for demonstrations. Registration numbers ending in 0 aren't found, numbers ending in 9 belong to dissolved companies, and all others pass. A real registry or KYB provider can replace it behind the `EligibilityVerifier` interface.

## Data and privacy

- Applications and their history are stored in Master Data v2 (`b2b_onboarding_application` and `b2b_onboarding_event`), with no public read, write or search.
- Documents are stored as Master Data v1 attachments under random IDs and file names that never reach the browser. Reviewers open them through the app, which checks their permission.
- Master Data v1 attachments are served to anyone who knows a document's ID and file name. For real company documents, move storage to private object storage with short-lived links behind the `DocumentStore` interface.
- The status code is stored only as a hash.

## Customization

CSS handles: `container`, `title`, `intro`, `demoNotice`, `form`, `section`, `sectionTitle`, `sectionHelp`, `field`, `fieldLabel`, `fieldInput`, `fieldError`, `fileName`, `formError`, `submit`, `receipt`, `receiptTitle`, `receiptValue`, `receiptCopy`, `receiptLink`, `statusContainer`, `statusTitle`, `statusForm`, `statusResult`, `statusBadge` and `statusReason`.

## Limitations

- The application form's rate limit is per server instance and resets on restart. Add a CAPTCHA or an edge rate limit for a public launch.
- Reviewers aren't notified by email of new applications.
- Approval runs while the reviewer waits, using their own token, so it can't be scheduled or run in the background.
