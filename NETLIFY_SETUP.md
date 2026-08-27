# Netlify deployment

Deploy this folder as the Netlify site base directory. The included `netlify.toml` publishes the site and routes browser requests to secure serverless functions.

In **Netlify → Site configuration → Environment variables**, add:

- `OPENAI_API_KEY` — required for OpenAI chat, speech and transcription
- `ANTHROPIC_API_KEY` — required for Claude chat
- `OPENAI_VOICE` — optional; defaults to `nova`
- `SITE_URL` — optional override for your full production origin, such as `https://example.com`; checkout automatically detects the deployed Netlify URL when omitted
- `CONSULTATION_WEBHOOK_URL` — optional; sends each consultation lead to your CRM or automation webhook
- `EMAIL_USER` — Gmail address used to send app emails; default business address is `productimaginationhere@gmail.com`
- `EMAIL_PASS` — Gmail App Password for `EMAIL_USER`; required to email consultation requests
- `EMAIL_TO` — optional consultation recipient override; defaults to `productimaginationhere@gmail.com`
- `EMAIL_HOST` — optional SMTP host; defaults to `smtp.gmail.com`
- `EMAIL_PORT` — optional SMTP port; defaults to `587`
- `STRIPE_SECRET_KEY` — required; your Stripe restricted or secret server key
- `STRIPE_WEBHOOK_SECRET` — required; signing secret for the Stripe webhook endpoint
- `CALENDLY_URL` — optional override; the included default is `https://calendly.com/metakittyz/30min`

Trigger a new deploy after changing environment variables. Confirm the connection by opening `/api/status` on the deployed site. It reports only whether each key exists; it never returns secret values.

Consultation requests from “Try It Free” and completed workflows are stored in the Netlify Blobs store named `consultation-leads` and emailed to `productimaginationhere@gmail.com` when `EMAIL_PASS` is configured. Each record includes the email, company, goal, project, selected template, selected package, source and submission time.

The completed workflow’s **Download Report** button calls `/api/report-pdf`. Netlify generates a private, uncached PDF containing the live business brief, quality scorecard, recommended next moves and each agent’s actual deliverable.

## Stripe activation

1. Add the Stripe and Calendly environment variables above in Netlify.
2. In Stripe Workbench, create a webhook endpoint at `https://YOUR-DOMAIN/api/stripe-webhook`.
3. Subscribe it to `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
4. Copy that endpoint’s `whsec_...` signing secret into `STRIPE_WEBHOOK_SECRET`.
5. Deploy again and complete a Stripe test-mode purchase before switching to a live secret key.

Checkout is configured for guest payment, so buyers do not need or create a Stripe login. Stripe Checkout dynamically shows the payment methods that are enabled and eligible for each buyer. Credit and debit cards work through the card payment method. Apple Pay is handled automatically on supported Apple devices and browsers when it is enabled in **Stripe Dashboard → Settings → Payment methods**.

PayPal must also be enabled in **Stripe Dashboard → Settings → Payment methods**. Stripe currently limits PayPal activation to eligible Stripe accounts in supported European countries, the United Kingdom, Liechtenstein, Norway and Switzerland. If the account is not eligible, Stripe will safely omit PayPal while card and Apple Pay continue to work. A PayPal business account must be connected in Stripe before live PayPal payments can be accepted.

Prices and product descriptions are created securely by the server from the package catalog. After Stripe confirms payment, the success page verifies the Checkout Session and gives the buyer a tailored ZIP containing every listed prompt and business-builder file. Full Business Builder buyers also receive the Calendly booking button.

Stripe account owner email: `Metakittyz@gmail.com`. This email does not authenticate the payment integration. Sign in to that Stripe account to obtain `STRIPE_SECRET_KEY` and create the webhook signing secret; never place either secret in HTML or send it through a public form.

Do not place API keys in HTML, JavaScript committed to the repository, or Netlify build logs.

