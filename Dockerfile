# Use official Node.js LTS image
FROM node:18

# Set working directory
WORKDIR /app

# Add netcat for wait-for-kafka.sh
RUN apt-get update && apt-get install -y netcat-openbsd

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy the entire source code
COPY . .

# Build the TypeScript project
RUN npm run build

# Default command (can be overridden in docker-compose)
CMD ["npm", "start"]
