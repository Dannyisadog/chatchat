const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const { createClient } = require('redis');
const redis = createClient();

const ROOM_PREFIX = "room/";

const main = async () => {
  redis.on('error', err => console.log('Redis Client Error', err));
  await redis.connect('DB0');

  app.get('/', (req, res) => {
    res.sendFile(__dirname + '/view/index.html');
  });

  const match = async (socket) => {
    const userCount = await redis.lLen('users');
    console.log(userCount);

    if (userCount < 2) {
      console.log("user count less then 2, can not match");
      return;
    }

    const user1 = await redis.lPop('users');
    const user2 = await redis.lPop('users');

    const newRoom = `${ROOM_PREFIX}${user1}-${user2}`;
    
    io.emit(user1, {
      action: 'matched',
      roomId: newRoom
    });
    io.emit(user2, {
      action: 'matched',
      roomId: newRoom
    });
  }

  io.on('connection', async (socket) => {
    const userId = `${socket.id}`;

    socket.on(userId, async (event) => {
      socket.emit(userId, event);
      console.log(event);
      if (event?.action == 'registerRoom') {
        const roomId = event.roomId;
        socket.on(roomId, (roomEvent) => {
          io.emit(roomId, roomEvent);
        })
      }

      if (event?.action == 'match') {
        await redis.lPush('users', userId);
        await socket.join(userId);
        match(socket);
      }
    })

    socket.on('disconnect', () => {
      redis.lPop('users');
      console.log(`user-${userId} disconnected`);
    });
  });

  server.listen(3000, () => {
    console.log('listening on *:3000');
  });
}

main();
