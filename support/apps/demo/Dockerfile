FROM node:24.22.0-bookworm-slim
RUN npm install --global pnpm@12.11.2
WORKDIR /course
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY support/apps/demo/package.json ./support/apps/demo/package.json
RUN pnpm --filter @terraform-playground/demo install --frozen-lockfile --prod
COPY support/apps/demo ./support/apps/demo
WORKDIR /course/support/apps/demo
ENV NODE_ENV=production
EXPOSE 8000
CMD ["node", "app.ts"]
