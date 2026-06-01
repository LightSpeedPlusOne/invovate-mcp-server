#!/usr/bin/env node
/**
 * Invovate MCP server
 *
 * Exposes the Invovate invoice API (https://invovate.com/api) as MCP tools so any
 * MCP-capable agent (Claude Desktop, Cursor, Windsurf, etc.) can generate
 * invoices. JSON math works with no API key; PDF/UBL output uses a free key set
 * via the INVOVATE_API_KEY environment variable.
 *
 * Tools:
 *   - calculate_invoice_totals  (no key needed)
 *   - generate_invoice_pdf      (returns a 7-day hosted link, or saves to a file)
 *   - generate_invoice_ubl      (returns UBL 2.1 XML; key required)
 *   - get_invoice_capabilities  (languages / currencies / templates)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const API_BASE = process.env.INVOVATE_API_BASE || 'https://invovate.com';
const API_KEY = process.env.INVOVATE_API_KEY || '';
const GEN_URL = API_BASE.replace(/\/$/, '') + '/api/generate-invoice';

const LANGUAGES = ['en', 'nl', 'de', 'fr', 'es', 'it', 'pt', 'ar', 'ja', 'ru', 'hi'];
const TEMPLATES = ['classic', 'modern', 'bold', 'minimal', 'navy'];

// ── Shared invoice input shape (zod raw shape) ───────────────────────────────
const party = z.object({
  name: z.string().describe('Party name (required).'),
  address: z.string().optional().describe('Multi-line address; use \\n for line breaks.'),
  email: z.string().optional(),
  tax_id: z.string().optional().describe('VAT / GST / tax registration number.'),
});

const item = z.object({
  description: z.string(),
  quantity: z.number().default(1),
  unit_price: z.number(),
  unit: z.string().optional().describe('Unit label, e.g. "hrs".'),
  tax_rate: z.number().optional().describe('Per-line tax percentage, e.g. 20 for 20%.'),
  discount: z.number().optional(),
  discount_type: z.enum(['percent', 'amount']).optional(),
});

const payment = z.object({
  pay_to: z.string().optional(),
  bank_name: z.string().optional(),
  account_name: z.string().optional(),
  account_number: z.string().optional(),
  iban: z.string().optional(),
  swift: z.string().optional(),
  method_note: z.string().optional().describe('e.g. "Paid by card ending **999".'),
}).optional();

const invoiceShape = {
  from: party.describe('The business issuing the invoice.'),
  to: party.describe('The customer being billed.'),
  items: z.array(item).min(1).describe('Line items (at least one).'),
  currency: z.string().optional().describe('ISO 4217 code, e.g. USD, EUR, GBP. Default USD.'),
  language: z.enum(LANGUAGES).optional().describe('Invoice language. Default en. ar/ja/hi/ru render with embedded fonts.'),
  template: z.enum(TEMPLATES).optional().describe('PDF template. Default classic.'),
  number: z.string().optional().describe('Invoice number; auto-generated if omitted.'),
  date: z.string().optional().describe('ISO date, e.g. 2026-06-01.'),
  due_date: z.string().optional(),
  po_number: z.string().optional(),
  notes: z.string().optional(),
  terms: z.string().optional().describe('Payment terms, e.g. "Net 30".'),
  global_tax: z.number().optional().describe('Tax % applied to all lines without their own tax_rate.'),
  global_discount: z.number().optional(),
  global_discount_type: z.enum(['percent', 'amount']).optional(),
  shipping: z.number().optional(),
  deposit: z.number().optional(),
  amount_paid: z.number().optional().describe('Amount already paid (for partial invoices).'),
  payment,
  accent_color: z.string().optional().describe('Hex color like #2563eb.'),
};

// ── API helper ───────────────────────────────────────────────────────────────
function buildBody(args, output, extra = {}) {
  const body = { output, ...extra };
  for (const k of Object.keys(invoiceShape)) {
    if (args[k] !== undefined) body[k] = args[k];
  }
  return body;
}

async function callApi(body, { binary = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (API_KEY) headers['Authorization'] = 'Bearer ' + API_KEY;
  const res = await fetch(GEN_URL, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    let msg = 'HTTP ' + res.status;
    try { const j = await res.json(); msg = (j.error && (j.error.message || j.error)) || msg; } catch { try { msg = (await res.text()).slice(0, 200); } catch {} }
    throw new Error(msg);
  }
  return binary ? Buffer.from(await res.arrayBuffer()) : res.json();
}

const ok = (text) => ({ content: [{ type: 'text', text }] });
const fail = (text) => ({ content: [{ type: 'text', text }], isError: true });

// ── Server ───────────────────────────────────────────────────────────────────
const server = new McpServer({ name: 'invovate', version: '0.1.0' });

server.tool(
  'calculate_invoice_totals',
  'Compute invoice totals (subtotal, per-line and global discounts, tax, shipping, deposit, grand total, balance due) without rendering a file. No API key required. Use this to validate amounts before generating a PDF.',
  invoiceShape,
  async (args) => {
    try {
      const r = await callApi(buildBody(args, 'json'));
      const inv = r.invoice || r;
      return ok(JSON.stringify({
        number: inv.number, currency: inv.currency, language: inv.language,
        subtotal: inv.subtotal, discount_total: inv.discount_total, shipping: inv.shipping,
        total_tax: inv.total_tax, tax_lines: inv.tax_lines, grand_total: inv.grand_total,
        amount_paid: inv.amount_paid, deposit: inv.deposit, balance_due: inv.balance_due,
        items: inv.items,
      }, null, 2));
    } catch (e) { return fail('calculate_invoice_totals failed: ' + e.message); }
  }
);

server.tool(
  'generate_invoice_pdf',
  'Generate a PDF invoice. By default returns a shareable 7-day hosted link that renders the PDF (best for chat — give the link to the user). If save_path is provided, the binary PDF is written to that local file instead. Set INVOVATE_API_KEY (free) for reliable PDF output.',
  { ...invoiceShape, save_path: z.string().optional().describe('Optional absolute path to write the .pdf file to. If omitted, a 7-day hosted link is returned.') },
  async (args) => {
    try {
      if (args.save_path) {
        const pdf = await callApi(buildBody(args, 'pdf'), { binary: true });
        const out = path.resolve(args.save_path.endsWith('.pdf') ? args.save_path : args.save_path + '.pdf');
        await writeFile(out, pdf);
        return ok(`PDF saved to ${out} (${pdf.length} bytes).`);
      }
      // Return a hosted link (renders the PDF on open) + the totals.
      const r = await callApi(buildBody(args, 'json', { features: { hosted_link: true } }));
      const inv = r.invoice || r;
      const url = inv.hosted_url;
      return ok([
        url ? `Invoice PDF ready (opens on this 7-day link):\n${url}` : 'Invoice generated (no hosted link returned).',
        `Number: ${inv.number} · ${inv.currency} · grand total ${inv.grand_total} · balance due ${inv.balance_due}`,
        url ? '' : 'Tip: set INVOVATE_API_KEY to enable hosted links / PDF output.',
      ].filter(Boolean).join('\n'));
    } catch (e) { return fail('generate_invoice_pdf failed: ' + e.message + (API_KEY ? '' : ' (PDF output needs INVOVATE_API_KEY)')); }
  }
);

server.tool(
  'generate_invoice_ubl',
  'Generate a UBL 2.1 XML invoice (for interoperability/archival — NOT a regulated e-invoice transmission; no Peppol/Factur-X/XRechnung compliance). Returns the XML as text. Requires INVOVATE_API_KEY.',
  invoiceShape,
  async (args) => {
    try {
      const xml = await callApi(buildBody(args, 'ubl'), { binary: true });
      return ok(xml.toString('utf8'));
    } catch (e) { return fail('generate_invoice_ubl failed: ' + e.message + (API_KEY ? '' : ' (UBL output needs INVOVATE_API_KEY)')); }
  }
);

server.tool(
  'get_invoice_capabilities',
  'List what the Invovate invoice API supports: languages, PDF templates, and notable features. Use this to pick valid language/template/currency values.',
  {},
  async () => ok(JSON.stringify({
    languages: LANGUAGES,
    rtl_or_non_latin: ['ar (right-to-left)', 'ja', 'hi', 'ru'],
    templates: TEMPLATES,
    currencies: 'ISO 4217 codes (USD, EUR, GBP, JPY, INR, SAR, AED, BRL, CAD, CHF, MXN, RUB, …)',
    outputs: ['json (totals)', 'pdf (hosted link or file)', 'ubl (XML)'],
    features: ['per-line & global discounts', 'single or multi-component tax', 'tax-inclusive pricing',
               'shipping, deposit, partial payment', 'logo & signature', 'structured payment block (IBAN/SWIFT)',
               'QR + 7-day hosted link', 'idempotent retries', 'webhooks'],
    auth: 'Free API key (inv_…) via INVOVATE_API_KEY. JSON math works without a key.',
    not_supported: 'Regulated e-invoice transmission (Peppol/Factur-X/ZUGFeRD/XRechnung/NF-e). UBL is for interoperability/archival only.',
    docs: 'https://invovate.com/invoice-api-for-ai-agents',
  }, null, 2))
);

// ── Start ────────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
console.error('invovate-mcp-server running (stdio). API key: ' + (API_KEY ? 'set' : 'not set — JSON only'));
