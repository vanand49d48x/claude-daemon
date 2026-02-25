FROM node:22-bookworm

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Create app directory
WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install --production

# Copy source
COPY src/ ./src/
COPY public/ ./public/

# Create data directory
RUN mkdir -p /data

EXPOSE 3456

CMD ["node", "src/daemon.js"]
