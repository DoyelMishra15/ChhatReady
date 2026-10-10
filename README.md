# ChhatReady

**Bill in, solar application pack out.** Upload a photo of an Indian electricity bill. ChhatReady reads it, asks you to confirm, takes your roof outline, and returns a rooftop-solar plan: system size, PM Surya Ghar subsidy, what you pay, payback, 25-year savings and CO₂. Then it hands you something to *do*: a filled-in application pack (PDF), an email or quote request to installers you choose, and a quote checker.

Built for WeMakeDevs Environmental Hacks.

## Run it (no AWS needed)

```bash
npm install
npm run dev          # API on :8787 (mock mode) + app on :5173
```
Open http://localhost:5173 and click **Try a sample bill**. In GitHub Codespaces the `.devcontainer` installs everything; just run `npm run dev` and open port 5173.

Mock mode (`MOCK_AWS=1`, the default for `npm run dev`) uses local files instead of AWS: uploads and cases go in `apps/api/.data/`, bill/quote reading returns saved sample values, and emails are written to `apps/api/.data/outbox/*.eml` instead of being sent. The deterministic engine, PDF, charts and UI are identical to production.

Check everything: `npm run check` (typecheck, tests, production build).

## What is real and what is mocked

| Piece | Mock mode | AWS mode |
|---|---|---|
| Bill/quote reading | saved sample results | Amazon Textract (Queries + Forms, falls back to line text) with validation |
| Storage | `.data/` folder | S3 (presigned PUT, 1-day lifecycle) + DynamoDB (TTL) |
| Email / RFQ | `.eml` files | Amazon SES v2 |
| Sunlight yield | seeded Jaipur value, regional default | PVGIS, cached; falls back to a regional default and says so |
| Plan, subsidy, payback, quote rules, PDF | **real** | **real** |

No fake installers exist anywhere. RFQs go only to addresses the user types, one message per installer, reply-to the homeowner, with explicit consent and per-plan send caps.

## How the numbers work (no AI in the core)

`packages/engine` is plain TypeScript with golden tests (`npm test -w @chhatready/engine`).
- **Rules** live in `rules/*.json` with their source, and are shown in the UI: subsidy ₹30,000/kW for the first 2 kW, ₹18,000 for the third, capped at ₹78,000 (check pmsuryaghar.gov.in for the current rule; state top-ups excluded); benchmark cost bands per kW; grid emission factor.
- **Sizing** = min(what your bill needs, what fits your roof, and your sanctioned load), rounded to 0.5 kW.
- **Cash flow** over 25 years: tariff escalation, degradation, upkeep, inverter replacement; interpolated payback and IRR.
- **Quote checker** is a rules list (price vs band, missing DCR/ALMM/net-metering/warranty mentions, size mismatch), not an LLM.
- The *How we calculated this* sheet shows every step and lets users change every assumption.

## Deploy to AWS

Prerequisites: AWS credentials in your shell (`aws configure` or SSO), Node 20+.
```bash
npm run bootstrap                  # once per account/region
SES_FROM=you@yourdomain.com npm run deploy
```
`deploy` builds the web app and runs CDK. Outputs: `SiteUrl` (CloudFront), `ApiUrl`, `TableName`, `UploadBucket`. Region defaults to `ap-south-1` (set `AWS_REGION` to change). Remove with `npm run destroy`.

Resources: S3 (uploads, site), CloudFront (OAC, SPA fallback), HTTP API + one Lambda (Hono), DynamoDB single table with TTL, Textract and SES permissions (least privilege), CloudWatch logs. The site reads the API URL from `/config.json` written at deploy time.

### SES
1. Verify your sender (`SES_FROM`) identity in the deployment region.
2. New accounts are in the **SES sandbox**: you can only send to verified addresses. Verify your own test recipients, or request production access in the SES console for real installer emails.
3. Test: `SES_FROM=you@x.com npm run smoke:ses -- you@x.com`.
4. Without `SES_FROM`, the app still works: the email/RFQ actions explain that sending isn't configured, and the Act screen offers *Email app*, *WhatsApp* and *Copy* so users can send the same message themselves.

### Textract
Test with your credentials: `npm run smoke:textract [file]`. Availability of Textract Queries in your chosen region was not verified when this was built; if Queries are rejected the extractor falls back to line detection, and users can always type values by hand on the Review screen.

## Environment variables

See `apps/api/.env.example` and `apps/web/.env.example`. Key ones: `MOCK_AWS`, `AWS_REGION`, `TABLE_NAME`, `UPLOAD_BUCKET` (set by CDK), `SES_FROM`, `APP_URL`, `ALLOWED_ORIGIN`, `CASE_TTL_DAYS`, `MAX_EMAILS_PER_CASE`, `MAX_RFQ_PER_CASE`, `PVGIS_BASE`.

To run the local API against real AWS: set `MOCK_AWS=0` plus the table/bucket variables in `apps/api/.env`, then `npm run dev -- --aws`.

## Layout

```
packages/engine   deterministic calculations, rules, schemas, golden tests
apps/api          Hono API (Lambda or Node), Textract/S3/DynamoDB/SES adapters + mocks
apps/web          React 19 + Vite + Tailwind 4 (Recharts, Leaflet, react-pdf)
infra             AWS CDK stack
rules/            subsidy, cost bands, emissions (dated, sourced)
demo/             sample bill + quote, fixtures, 3-minute script
scripts/          dev runner, Textract/SES smoke tests, PVGIS seeding, sample asset generator
```

## Privacy

No accounts. Bill photos are deleted after one to two days (S3 lifecycle); plans expire after about 30 days (DynamoDB TTL); users can delete everything at any time from the Act screen. The share link is read-only and hides the consumer number, exact location and application pack. The consumer number is never included in RFQ emails. Details in the app at `/privacy`.

## Known limitations

- Sunlight data in mock mode is an illustrative seed; run `npm run seed:pvgis` with internet access to replace it with real PVGIS values.
- The grid emission factor (0.71 t/MWh) is a placeholder to confirm against the latest CEA figure.
- Extraction accuracy on real bills has not been measured; the sample bill is synthetic with a fictional DISCOM. Review always lets users correct values.
- English only; no state-specific subsidies; benchmark costs are indicative ranges, not quotes.
- Deployment to AWS was synthesised and unit-tested, not deployed from this environment.
