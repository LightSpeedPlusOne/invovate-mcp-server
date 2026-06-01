#!/usr/bin/env node
/**
 * Smoke test: spawns the MCP server over stdio, lists tools, and exercises the
 * live API. calculate_invoice_totals needs no key; generate_invoice_pdf runs
 * only if INVOVATE_API_KEY is set in the environment.
 *
 *   node test/smoke.js
 *   INVOVATE_API_KEY=inv_xxx node test/smoke.js
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.join(__dirname, '..', 'src', 'index.js');

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [SERVER],
  env: { ...process.env },
});
const client = new Client({ name: 'smoke', version: '1.0.0' });

let failures = 0;
const check = (cond, label) => { console.log((cond ? '  ✓ ' : '  ✗ ') + label); if (!cond) failures++; };

try {
  await client.connect(transport);

  const { tools } = await client.listTools();
  const names = tools.map(t => t.name).sort();
  console.log('Tools:', names.join(', '));
  check(names.length === 4, 'exposes 4 tools');
  check(names.includes('calculate_invoice_totals'), 'has calculate_invoice_totals');
  check(names.includes('generate_invoice_pdf'), 'has generate_invoice_pdf');
  check(names.includes('generate_invoice_ubl'), 'has generate_invoice_ubl');

  const cap = await client.callTool({ name: 'get_invoice_capabilities', arguments: {} });
  check(/languages/.test(cap.content[0].text), 'get_invoice_capabilities returns data');

  const calc = await client.callTool({
    name: 'calculate_invoice_totals',
    arguments: {
      from: { name: 'Acme LLC' }, to: { name: 'Globex Corp' }, currency: 'EUR',
      items: [{ description: 'Consulting', quantity: 2, unit_price: 100, tax_rate: 20 }],
    },
  });
  const txt = calc.content[0].text;
  console.log('  calc →', txt.replace(/\s+/g, ' ').slice(0, 120));
  check(!calc.isError && /"grand_total":\s*240/.test(txt), 'calculate_invoice_totals: 2×100 +20% = 240');

  if (process.env.INVOVATE_API_KEY) {
    const pdf = await client.callTool({
      name: 'generate_invoice_pdf',
      arguments: {
        from: { name: 'Acme LLC' }, to: { name: 'Globex Corp' }, language: 'en', currency: 'USD',
        items: [{ description: 'Design', quantity: 1, unit_price: 500, tax_rate: 10 }],
      },
    });
    const p = pdf.content[0].text;
    console.log('  pdf →', p.replace(/\s+/g, ' ').slice(0, 140));
    check(!pdf.isError && /https:\/\/invovate\.com\/api\/i\//.test(p), 'generate_invoice_pdf returns a hosted link');
  } else {
    console.log('  (skipping generate_invoice_pdf — set INVOVATE_API_KEY to test it)');
  }

  await client.close();
} catch (e) {
  console.error('FATAL:', e.message);
  failures++;
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
