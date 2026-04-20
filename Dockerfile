# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches/

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Raise Node heap ceiling so vite's transform step survives on
# small-RAM build hosts (Coolify/VPS). Default ~1.5GB can OOM-kill
# a mid-sized React build and exit code 255 with no error text.
ENV NODE_OPTIONS=--max-old-space-size=4096

# Build the application
RUN pnpm build

# Prune devDependencies IN PLACE so the runtime image can copy a
# slim node_modules directly from this stage. This replaces the
# previous approach of running a second `pnpm install --prod` in
# the production stage — BuildKit was running both installs in
# parallel, doubling peak RAM during image build and racing against
# the vite build inside the builder stage.
RUN pnpm prune --prod

# Production stage
FROM node:22-alpine AS production

WORKDIR /app

# Reuse the slim (prod-only) node_modules produced by the builder.
# No second `pnpm install` here on purpose: that was the main source
# of OOM failures on the deployment host.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle

# Expose port
EXPOSE 3000

# Set environment (PORT must match HEALTHCHECK and EXPOSE)
ENV NODE_ENV=production
ENV PORT=3000

# Health check: HTTP 200 from /api/health (node one-liner, no wget/curl needed)
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# Start the application
CMD ["node", "dist/index.js"]
