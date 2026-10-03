
### AI endpoint protection

The OpenAI routes use Vercel's first-party `@vercel/firewall` rate-limit SDK in deployed Vercel environments. Before enabling the public endpoints, create and publish a Firewall rate-limit rule for each ID below. Set the rule condition to `@vercel/firewall`, use the matching **Rate Limit ID**, choose **IP** as the key, and configure a **10-minute fixed window**:

| Rate limit ID | Limit |
| --- | ---: |
| `lumora-image-generation` | 3 requests |
| `lumora-look-analysis` | 10 requests |

The rate-limit ID must exactly match the value above. Requests fail closed with a structured 503 until the matching rule is configured. Vercel Firewall rate-limit usage is subject to the project's plan and pricing; counters are regional. Local development uses an in-memory per-IP limit and does not replace the production Firewall rules.

Request bodies are streamed with byte caps (11 MB for image generation and 16 MB for analysis). Each base64 image data URL is limited to 5 MB and its decoded bytes must match its declared JPEG, PNG, WebP, or GIF signature.
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Look Analysis

Lumora image generation sends the original photo and inspiration to the server-side OpenAI Images API (`gpt-image-2.5-sunburst` by default); override it with `OPENAI_IMAGE_MODEL`. Look Analysis then sends the original, inspiration, and generated result to the server-side OpenAI vision adapter. Set `OPENAI_API_KEY` in `.env.local` (never expose it through a `NEXT_PUBLIC_` variable). Optionally set `OPENAI_VISION_MODEL`; it defaults to `gpt-4o-mini`. The expandable analysis JSON is available on the result screen in development.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
