# Use an official Node.js runtime as a parent image
# We are using a stable, long-term support version
FROM node:20-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and the lock file to leverage Docker cache
COPY package*.json ./

# Install project dependencies
RUN npm install

# Copy the rest of the application's source code
COPY . .

# Build the TypeScript project into JavaScript
# This creates the 'dist' directory
RUN npm run build

# Expose the port the app runs on
EXPOSE 3001

# Command to run the development server
# This will watch for file changes and restart the server
CMD npm run dev
