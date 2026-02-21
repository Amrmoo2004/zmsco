import 'dotenv/config';
import http from 'http';
import { bootstrap } from './app.js';
import { initSocket } from './utils/socket.js';

const app = await bootstrap();
const server = http.createServer(app);

initSocket(server);

const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`🚀 Server is running at http://localhost:${port}`);
    console.log(`⚡ Socket.IO is listening on ws://localhost:${port}`);
});