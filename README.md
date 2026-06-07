# Invovate MCP Server

[![npm](https://img.shields.io/npm/v/invovate-mcp-server)](https://www.npmjs.com/package/invovate-mcp-server)
[![MCP Registry](https://img.shields.io/badge/MCP%20Registry-invovate-2563eb)](https://registry.modelcontextprotocol.io)
[![Glama](https://img.shields.io/badge/Glama-MCP%20server-7c3aed)](https://glama.ai/mcp/servers/LightSpeedPlusOne/invovate-mcp-server)
[![OpenAPI](https://img.shields.io/badge/OpenAPI-3.1-085f73)](https://invovate.com/openapi.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Invovate MCP Server is a free, no-signup invoice MCP server for Claude, Cursor, and other MCP clients — it generates invoices as PDF, JSON, and UBL 2.1 via the [Invovate invoice API](https://invovate.com/api).**

Let AI agents generate **PDF, JSON, and UBL 2.1 invoices in 11 languages**
(including right-to-left Arabic, Japanese, Hindi, and Cyrillic) through the
[Invovate invoice API](https://invovate.com/api). Works with Claude Desktop,
Cursor, Windsurf, and any [MCP](https://modelcontextprotocol.io)-capable client.

JSON math works with **no API key**; PDF/UBL output uses a free key.

## Tools

| Tool | What it does | Key needed |
|------|--------------|------------|
| `calculate_invoice_totals` | Compute subtotal, discounts, tax, shipping, deposit, grand total, balance due — no file rendered. | No |
| `generate_invoice_pdf` | Generate a PDF. Returns a 7-day hosted link (great for chat), or writes the file when `save_path` is given. | Required |
| `generate_invoice_ubl` | Generate UBL 2.1 XML (interoperability/archival only — *not* regulated e-invoicing). | Yes |
| `get_invoice_capabilities` | List supported languages, templates, currencies, and features. | No |

## Get a free API key

Sign up at **https://invovate.com/auth** — your key starts with `inv_`. Free tier,
no credit card. (`calculate_invoice_totals` works without a key; PDF, UBL, QR, and hosted links require a free key.)

## Install

### Claude Desktop

Add to `claude_desktop_config.json`
(`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS,
`%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "invovate": {
      "command": "npx",
      "args": ["-y", "invovate-mcp-server"],
      "env": { "INVOVATE_API_KEY": "inv_your_key_here" }
    }
  }
}
```

Restart Claude Desktop. Then ask: *“Create an invoice for Acme BV billing Globex
for 3 consulting days at €900/day with 21% VAT, in English, and give me the PDF.”*

### Cursor / Windsurf

Add the same block to the MCP config (`~/.cursor/mcp.json` for Cursor, or the
Windsurf MCP settings).

### Run from source (before npm publish)

```bash
git clone https://github.com/LightSpeedPlusOne/invovate-mcp-server.git
cd invovate-mcp-server && npm install
INVOVATE_API_KEY=inv_your_key node src/index.js
```

…and point your client at it:

```json
{
  "mcpServers": {
    "invovate": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/src/index.js"],
      "env": { "INVOVATE_API_KEY": "inv_your_key_here" }
    }
  }
}
```

## Configuration

| Env var | Default | Purpose |
|---------|---------|---------|
| `INVOVATE_API_KEY` | — | Free API key (`inv_…`). Enables PDF/UBL output and hosted links. |
| `INVOVATE_API_BASE` | `https://invovate.com` | Override the API base (rarely needed). |

## Test

```bash
npm test                                   # lists tools + JSON math (no key)
INVOVATE_API_KEY=inv_xxx npm test          # also exercises the PDF hosted-link path
```

## Notes

- **Not regulated e-invoicing.** UBL export is for interoperability/archival only.
  No Peppol / Factur-X / ZUGFeRD / XRechnung / NF-e compliance or network delivery.
- Hosted links expire and the invoice is deleted after 7 days.
- Docs for agents: https://invovate.com/invoice-api-for-ai-agents · OpenAPI: https://invovate.com/openapi.json

## Example prompts

Once connected, ask your AI client in natural language:

```text
Create an invoice for Acme Ltd for 3 hours of consulting at $120/hour. Return it as a PDF.
Generate a UBL 2.1 invoice for a SaaS subscription charged €49/month.
Make a Japanese invoice (¥) for ¥350,000 of web design with 10% consumption tax, and give me the link.
```

## Links

- **Invoice API & docs:** https://invovate.com/api · https://invovate.com/invoice-api-for-ai-agents
- **OpenAPI 3.1 spec:** https://invovate.com/openapi.json (import as a ChatGPT / Claude Action)
- **MCP landing page:** https://invovate.com/mcp-invoice-generator · **All integrations:** https://invovate.com/integrations
- **npm (this package):** https://www.npmjs.com/package/invovate-mcp-server
- **Python SDK:** https://pypi.org/project/invovate/ · **JavaScript SDK:** https://www.npmjs.com/package/invovate
- **Glama MCP directory:** https://glama.ai/mcp/servers/LightSpeedPlusOne/invovate-mcp-server
- **Postman collection:** https://www.postman.com/lightspeedplusone-9440989/workspace/invovate-invoice-api/overview
- **RapidAPI:** https://rapidapi.com/LightSpeedPlusOne/api/invovate-invoice
- **WordPress plugin:** https://wordpress.org/plugins/invovate-invoice-generator/

## License

MIT © Invovate
