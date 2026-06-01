# Invovate MCP server (stdio transport).
#
# Glama builds this image, starts the container, and sends an MCP introspection
# request (tools/list) over stdio. Listing tools is local and needs no API key,
# so the checks pass without any secrets. At runtime, set INVOVATE_API_KEY to
# enable the PDF/UBL tools (calculate_invoice_totals works without one).
FROM node:20-alpine

WORKDIR /app

# Install production dependencies from the lockfile (reproducible).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Application source.
COPY . .

# Speak MCP over stdio.
ENTRYPOINT ["node", "src/index.js"]
