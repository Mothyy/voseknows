# Use an official Node.js runtime as a parent image (Debian-based for easier Playwright/Python support)
FROM node:20-bookworm

# Install Python and system dependencies for Playwright
RUN apt-get update && apt-get install -y \
    libgbm-dev \
    libnss3 \
    libasound2 \
    libxshmfence1 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgtk-3-0 \
    libpango-1.0-0 \
    libcairo2 \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory in the container
WORKDIR /app

# Copy package.json and the lock file
COPY backend/package*.json ./

# Install Node dependencies
# Install Node dependencies
RUN npm install

# Install browsers for Node.js playwright
RUN npx playwright install chromium

# Copy the rest of the application's source code
# Since context is root, we copy the backend subfolder specifically
COPY backend/ ./src
# Wait, if we copy backend/ to ./src, then our paths in code might need to change? 
# No, let's copy backend/ content to /app/
COPY backend/ .

# Build the TypeScript project
RUN npm run build

# Expose the port the app runs on
EXPOSE 3001

# Command to run the development server
CMD ["npm", "run", "dev"]
