FROM node:20-alpine

WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm install

# Copy all project files
COPY . .

# Expose port
EXPOSE 3001

ENV NODE_ENV=production
CMD ["node", "backend/server.js"]
