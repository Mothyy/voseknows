FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Expose typical Expo/Metro ports
EXPOSE 8081 19000 19001 19002

# Default command to start the development server
CMD ["npx", "expo", "start", "--host", "lan"]
