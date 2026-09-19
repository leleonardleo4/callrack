/**
 * Builds `GET /` - a minimal index, not a website: a human landing here by
 * accident or a link-preview crawler gets real metadata and a short list of
 * where to actually go (docs, discovery files, the product site). No
 * styling framework, no client-side JS, nothing that would make this its
 * own product surface - that's `apps/web`'s job.
 *
 * `og:image`/`twitter:image` point at `${origin}/og-image.png` - the API's
 * own copy of the same asset `apps/web/public/og-image.png` is, served
 * directly by this process (see bootstrap.ts's `@fastify/static`
 * registration) so a link preview for the bare API URL doesn't depend on
 * `callrack.xyz` being reachable. This is deliberately a duplicate file,
 * not a shared one: `x402-merchant.logo` (merchant-extension.builder.ts)
 * still points at the product domain's `favicon.png`, since GoPlausible's
 * enrichment crawl reads that field, not this page.
 */
export function buildRootPage(origin: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Callrack API</title>
    <meta
      name="description"
      content="Callrack's pay-per-use information API. This is the API host, not the product site - see the links below for documentation and discovery files."
    />

    <meta property="og:site_name" content="Callrack" />
    <meta property="og:title" content="Callrack API" />
    <meta
      property="og:description"
      content="Pay-per-use information infrastructure, paid per request in USDC on Algorand via x402."
    />
    <meta property="og:url" content="${origin}" />
    <meta property="og:image" content="${origin}/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${origin}/og-image.png" />
  </head>
  <body>
    <h1>Callrack API</h1>
    <p>This is the API host. For the product site, see <a href="https://callrack.xyz">callrack.xyz</a>.</p>
    <ul>
      <li><a href="${origin}/v1/capabilities">/v1/capabilities</a> - every paid endpoint, live pricing</li>
      <li><a href="${origin}/docs">/docs</a> - interactive API docs (Swagger)</li>
      <li><a href="${origin}/openapi.json">/openapi.json</a> - OpenAPI document</li>
      <li><a href="${origin}/health">/health</a> - health check</li>
      <li><a href="${origin}/llms.txt">/llms.txt</a> - machine-readable summary for LLMs</li>
      <li><a href="${origin}/agents.md">/agents.md</a> - operating instructions for agents</li>
      <li><a href="${origin}/.well-known/x402">/.well-known/x402</a></li>
      <li><a href="${origin}/.well-known/agent-card.json">/.well-known/agent-card.json</a></li>
      <li><a href="${origin}/.well-known/agent.json">/.well-known/agent.json</a></li>
    </ul>
  </body>
</html>
`;
}
