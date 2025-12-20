# Use an official Node.js runtime as a parent image
FROM node:20-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to leverage Docker cache
COPY package*.json ./

# Force a clean install by removing old dependencies and lock file
RUN rm -rf node_modules package-lock.json

# Install project dependencies
RUN npm install

# Copy the rest of the applications source code
COPY . .

# Expose the port the app runs on
EXPOSE 5173

# Command to run the development server
CMD ["npm", "run", "dev"]
