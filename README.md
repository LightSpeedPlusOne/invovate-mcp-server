# Invovate MCP Server

Let AI agents generate **PDF, JSON, and UBL 2.1 invoices in 11 languages**
(including right-to-left Arabic, Japanese, Hindi, and Cyrillic) through the
[Invovate invoice API](https://invovate.com/api). Works with Claude Desktop,
Cursor, Windsurf, and any [MCP](https://modelcontextprotocol.io)-capable client.

JSON math works with **no API key**; PDF/UBL output uses a free key.

## Tools

| Tool | What it does | Key needed |
|------|--------------|------------|
| `calculate_invoice_totals` | Compute subtotal, discounts, tax, shipping, deposit, grand total, balance due — no file rendered. | No |
| `generate_invoice_pdf` | Generate a PDF. Returns a 7-day hosted link (great for chat), or writes the file when `save_path` is given. | Recommended |
| `generate_invoice_ubl` | Generate UBL 2.1 XML (interoperability/archival only — *not* regulated e-invoicing). | Yes |
| `get_invoice_capabilities` | List supported languages, templates, currencies, and features. | No |

## Get a free API key

Sign up at **https://invovate.com/auth** — your key starts with `inv_`. Free tier,
no credit card. (You can use the server without a key for `calculate_invoice_totals`.)

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
git clone <this repo> && cd mcp-server && npm install
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

## License

MIT © Invovate
