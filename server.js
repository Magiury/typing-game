const WebSocket = require("ws");

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

let waitingPlayer = null;
let rooms = new Map();

function createRoom(p1, p2) {
  const id = Math.random().toString(36).slice(2);
  const room = {
    id,
    players: [p1, p2],
    scores: [0, 0],
    sender: 0,
    answer: ""
  };
  rooms.set(id, room);
  p1.room = id;
  p2.room = id;

  room.players.forEach((p, i) => {
    p.send(JSON.stringify({
      type: "start",
      you: i,
      sender: room.sender,
      scores: room.scores
    }));
  });
}

wss.on("connection", ws => {
  ws.on("message", msg => {
    const data = JSON.parse(msg.toString());

    if (data.type === "join") {
      if (!waitingPlayer) {
        waitingPlayer = ws;
        ws.send(JSON.stringify({ type: "waiting" }));
      } else {
        createRoom(waitingPlayer, ws);
        waitingPlayer = null;
      }
    }

    if (data.type === "morse") {
      const room = rooms.get(ws.room);
      room.answer = data.text;
      room.players.forEach(p =>
        p.send(JSON.stringify({ type: "playMorse", morse: data.morse }))
      );
    }

    if (data.type === "guess") {
      const room = rooms.get(ws.room);
      if (data.text === room.answer) {
        room.scores[data.player]++;
      }

      room.sender = 1 - room.sender;

      room.players.forEach(p =>
        p.send(JSON.stringify({
          type: "roundEnd",
          scores: room.scores,
          sender: room.sender
        }))
      );

      if (Math.abs(room.scores[0] - room.scores[1]) >= 5) {
        room.players.forEach(p =>
          p.send(JSON.stringify({ type: "gameOver" }))
        );
        rooms.delete(room.id);
      }
    }
  });

  ws.on("close", () => {
    if (waitingPlayer === ws) waitingPlayer = null;
    if (ws.room && rooms.has(ws.room)) {
      const room = rooms.get(ws.room);
      room.players.forEach(p =>
        p.send(JSON.stringify({ type: "opponentLeft" }))
      );
      rooms.delete(ws.room);
    }
  });
});

console.log("Server running on port", PORT);

