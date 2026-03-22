const http = require('http');
const { WebSocketServer } = require('ws');

const server = http.createServer();
const wss = new WebSocketServer({ server });

const rooms = new Map();
const users = new Map();

wss.on('connection', (ws) => {
  let currentUser = null;
  let currentRoom = null;

  ws.on('message', (data) => {
    const msg = JSON.parse(data);

    switch (msg.type) {
      case 'join': {
        currentUser = msg.username;
        currentRoom = msg.room;
        users.set(currentUser, ws);

        if (!rooms.has(currentRoom)) {
          rooms.set(currentRoom, new Set());
        }
        rooms.get(currentRoom).add(currentUser);

        broadcast(currentRoom, {
          type: 'system',
          text: `${currentUser} joined the room`,
          timestamp: Date.now(),
        });
        break;
      }

      case 'message': {
        const messageObj = {
          type: 'message',
          from: currentUser,
          text: msg.text,
          room: currentRoom,
          timestamp: Date.now(),
          id: messageCounter++,
        };
        messageHistory.push(messageObj);
        broadcast(currentRoom, messageObj);
        break;
      }

      case 'private': {
        const targetWs = users.get(msg.to);
        if (targetWs) {
          targetWs.send(JSON.stringify({
            type: 'private',
            from: currentUser,
            text: msg.text,
            timestamp: Date.now(),
          }));
        }
        break;
      }

      case 'history': {
        const history = messageHistory.filter(m => m.room === msg.room);
        ws.send(JSON.stringify({ type: 'history', messages: history }));
        break;
      }
    }
  });

  ws.on('close', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      rooms.get(currentRoom).delete(currentUser);
      broadcast(currentRoom, {
        type: 'system',
        text: `${currentUser} left the room`,
        timestamp: Date.now(),
      });
    }
  });
});

let messageCounter = 0;
const messageHistory = [];

function broadcast(room, message) {
  const roomUsers = rooms.get(room);
  if (!roomUsers) return;

  const data = JSON.stringify(message);
  for (const username of roomUsers) {
    const ws = users.get(username);
    ws.send(data);
  }
}

function getOnlineUsers(room) {
  return Array.from(rooms.get(room) || []);
}

server.listen(process.env.PORT || 3002);
module.exports = { server, wss };
