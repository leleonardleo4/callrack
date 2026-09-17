# Callrack

Instructions for agents working with Callrack.

This is the brand/marketing site (`callrack.xyz`). The paid API lives on a separate origin
(`api.callrack.xyz`) and publishes its own, always-current `agents.md` generated directly from
Callrack's capability registry:

- Full operating instructions: https://api.callrack.xyz/agents.md
- Live capability list + prices: https://api.callrack.xyz/llms.txt
- OpenAPI: https://api.callrack.xyz/openapi.json

## Payment (summary)
Every capability endpoint under `api.callrack.xyz` is x402-paid. On HTTP 402, read the PAYMENT-REQUIRED
response header for the exact current payment requirement, pay the advertised amount in USDC on Algorand,
then retry the same request with a PAYMENT-SIGNATURE header. Treat the live 402 response as authoritative:
never hardcode or assume a price.
