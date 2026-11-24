# Testing B2B Onboarding

Last full test: 2026-11-24, version 0.3.2, in the `b2btest` workspace.

## Review against VTEX's skills

Reviewed against the VTEX IO track of https://github.com/vtex/skills. Version 0.3.1 already included fixes from an earlier review (no automatic retries on create calls, no error details from the public routes, one settings read, a platform rate limit).

| Area | Result |
| --- | --- |
| Public routes (`/_v/b2b-onboarding/apply` and `/status`): per-visitor rate limit, multipart only, size limits, server-side validation of every field and file, `Cache-Control: no-store`, plain error codes, no personal data in logs | Pass |
| GraphQL: `@auth` with a License Manager resource on every operation, `@cacheControl(scope: PRIVATE)` on queries, none on mutations | Pass |
| Master Data v2 schemas: private, no public read or write, no caching, PAN and bank details never indexed | Pass |
| App settings: no secrets, not public | Pass |
| Admin pages: VTEX Styleguide, `admin/` messages | Pass |
| Storefront pages: CSS handles, `store/` messages, data loaded in the browser | Pass |
| Links built from the binding's path prefix without `//` | Fixed in 0.3.2 |
| Master Data through `ExternalClient` on `{account}.vtexcommercestable.com.br` | Accepted exception: VTEX documents the `ADMIN_DS` policy for that host, while the built-in client calls `api.vtex.com`. Documented in `node/clients/accountMasterData.ts`. |
| Applicant routes are REST, not GraphQL | Accepted exception: the store sends GraphQL queries as GET requests, which would put the status code in URLs and logs. |

## Automated checks

```bash
yarn lint                        # 0 errors; 21 warnings for accepted `any` types
yarn test                        # 219 tests (backend and React helpers)
cd react && npx tsc --noEmit     # no errors
cd node && npx tsc --noEmit      # no errors
```

## What was tested, and how

All in `b2btest` on 2026-11-24, logged in to the store and Admin.

1. **Form (read-only):** opened `/business-application`, clicked Continue with empty fields, chose India, and entered an individual's PAN, a malformed PAN and a company PAN.
2. **Status page (read-only):** entered a made-up reference and code.
3. **Admin (read-only):** opened the queue and the three demo applications.
4. **Version 0.3.2 fixes:** checked country names in the form and on the Admin page, and the stepper's stage types.
5. **Write tests:** submitted two India applications to the apply route with generated sample files, using the simulated provider's rules (0 fails, 5 needs review, a bank account ending in 7 gives a partial name match):
   - Application A, all checks passing: accepted both documents, passed Document review, ran verification, passed Compliance check, revealed the full PAN, then rejected at Final approval so no organization was created.
   - Application B, needing review: accepted both documents, passed Document review, ran verification, tried to pass before deciding, accepted the PAN, rejected the bank account, tried to pass again, then rejected.
   - Checked both from the applicant's side with their status codes, and read both histories.
6. **Clean-up:** deleted both applications, their 9 history entries and their 4 files. The `BD` file table went back to its 8 earlier records.

### Results

| Check | Result |
| --- | --- |
| Empty Continue | "Required" on each field and "Please correct the highlighted fields." |
| Choosing India | Adds Business's PAN, Udyam (optional) and "Do you import or export?" |
| PAN `ABCPE1234F` (individual) | "This is an individual's PAN…" |
| PAN `ABC12` | "Check the format" |
| PAN `ABCCE1234F` (company) | Accepted |
| Status page with a wrong reference | "No application matches this reference and status code." (doesn't reveal whether the reference exists) |
| Admin queue and detail pages | Load, with documents and history |
| Country names (0.3.2) | Form, Review step and Admin show names, such as India |
| Stepper (0.3.2) | Manual review, Automated check, Final decision |
| Submissions | `201` with a reference and status code |
| A: KYC results | PAN, IEC, Udyam and bank account verified, strong name matches, outcome ready |
| B: KYC results | PAN needs review; bank account partial name match (0.67), needs review; outcome needs a decision |
| Masking | PAN `XXXXX1234F`, account `XXXXXXXX9012` in the API and on the page |
| B: pass before deciding | Refused: "Accept or reject every check that needs a manual review first" |
| B: pass after rejecting a check | Refused: "The verification failed, so this stage can only be rejected" |
| A: reveal PAN | Full value returned, and recorded in the history |
| Applicant's view | Rejected, with the reason meant for the applicant; only public fields |
| History | Every step recorded, including KYC decisions and the reveal |
| Clean-up | Applications, history entries and files deleted |

### Found during testing

- The first attempt to delete the uploaded files failed with `404`: an application's `storageId` is `<record ID>/<stored file name>`, and the whole value was sent as the record ID. Deleting a `BD` record needs only the part before the `/`. The `BD` table's fields are private, so it can't be searched by application; the test files were found by their creation time, and their records deleted with `204`.
- The `BD` table's display name contains a task code. The Master Data API only allows reading a table's settings (`405`, `Allow: GET`), so it must be renamed in Admin.

### Not tested

- Approving an application, which creates a real organization. Last tested on 2026-11-12 (`APP-5VKMQCZC`).
- A real file upload through the browser's drop zone (the write tests posted the same multipart request the form sends).
- The rate limits.

## Manual test steps

Use https://b2btest--logixalpartnerus.myvtex.com/ in Chrome. Use clearly fake data: company names starting with `TEST -`, `example.com` email addresses, and sample PDF or PNG files under 5 MB. Applications are real account data, so delete them afterwards or keep them as labeled demo data.

The simulated providers decide by the last digit:

| Check | Ends in 0 | Ends in 5 | Ends in 9 | Anything else |
| --- | --- | --- | --- | --- |
| Registration number (company registry) | Not found | Passes | Dissolved | Passes |
| PAN (its 4 digits), IEC, Udyam | Fails | Needs manual review | Passes | Passes |
| Bank account | Fails | Needs manual review | Passes | Passes; ending in 7 gives a partial name match |

1. **Apply (any country)**
   1. Open `/business-application`.
   2. Click **Continue** without filling anything. Check that the fields say "Required".
   3. Fill in the Company step with country **United States**, then Administrator, Address and Documents (upload one PDF and one PNG), and check the Review step. Check that the country shows as a name.
   4. Submit. Note the reference and status code from the receipt.
2. **Apply from India**
   1. Start a new application and choose **India**. Check that the PAN, Udyam and import/export questions appear, and that a Bank account step is added.
   2. Try PAN `ABCPE1234F`: it should be refused as an individual's PAN. Use `ABCCK1234F`.
   3. Answer **Yes** to import or export and enter an IEC such as `0512345678`.
   4. On Bank account, enter account `123456789017`, IFSC `HDFC0001234`, and the company name as holder.
   5. Submit and note the reference.
3. **Check status as the applicant**
   1. Open `/business-application/status`, enter the reference and status code. Check that it shows the current step.
   2. Enter a wrong code. Check that it says no application matches.
4. **Review in Admin**
   1. Open Admin → **Apps → Installed Apps → B2B onboarding** (or `/admin/app/b2b-onboarding`). Check that the application is listed, and try the status filters.
   2. Open the application. Check the stepper (Manual review, Automated check, Final decision) and the address with the country name.
   3. Accept both documents and pass **Document review**.
   4. On **Compliance check**, run the verification. For the India application, check each identifier's result and name match, and that PAN and account number are masked.
   5. Try to pass the stage: it should ask you to decide the checks that need a review. Accept or reject them with a note.
   6. Click **Show full number** on the PAN. Check that the full value appears and that the history records it.
   7. Pass the stage, then **reject** at Final approval with a reason (approving creates a real organization).
5. **Applicant sees the decision**
   1. Check the status page again. It should say Rejected and show the reason, without internal notes.

If something fails, note the reference, the step and any message on screen, and check the browser console.
