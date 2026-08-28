FROM node:20-alpine

WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm install

# Install frontend dependencies
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install

# Copy all source files
COPY . .

# Build frontend for production
RUN cd frontend && npm run build

ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "backend/server.js"]
