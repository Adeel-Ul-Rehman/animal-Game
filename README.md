# Animal Battle Game

A real-time multiplayer animal battle game built with Node.js, Express, Socket.IO, and React.

## Project Structure

- **server/**: Backend server code
  - **models/**: Database models
  - **routes/**: API routes
  - **controllers/**: Route controllers
  - **middleware/**: Custom middleware
  - **sockets/**: Socket.IO event handlers
  - **config/**: Configuration files
  - **utils/**: Utility functions
  - **server.js**: Main server entry point

- **client/**: Frontend React application
  - **public/**: Static files
  - **src/**: Source code
    - **components/**: Reusable React components
    - **pages/**: Page components
    - **context/**: React context providers
    - **sockets/**: Socket.IO client code
    - **utils/**: Utility functions
    - **assets/**: Images and sounds

## Installation

1. Install server dependencies:
   ```
   npm install
   ```

2. Install client dependencies:
   ```
   cd client
   npm install
   ```

## Running the Application

1. Start the server:
   ```
   npm start
   ```

2. Start the client (in a separate terminal):
   ```
   npm run client
   ```

## Environment Variables

Create a `.env` file in the root directory with:
- `PORT`: Server port (default: 5000)
- `NODE_ENV`: Environment (development/production)
