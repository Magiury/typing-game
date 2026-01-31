const WebSocket = require("ws");

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

let waitingPlayer = null;
const rooms = new Map();

function createRoom(p1, p2) {
  const roomId = Math.random().toString(36).slice(2);

  const room = {
    id: roomId,
    players: [p1, p2],
    scores: [0, 0],
    sender: 0,
    answer: ""
  };

  rooms.set(roomId, room);

  p1.roomId = roomId;
  p2.roomId = roomId;

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
  ws.isAlive = true;
  ws.hasJoined = false;

  ws.on("message", raw => {
    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      return;
    }

    // 🔑 JOIN — CHỈ CHO JOIN 1 LẦN
    if (data.type === "join" && !ws.hasJoined) {
      ws.hasJoined = true;

      if (waitingPlayer && waitingPlayer.readyState === WebSocket.OPEN) {
        createRoom(waitingPlayer, ws);
        waitingPlayer = null;
      } else {
        waitingPlayer = ws;
        ws.send(JSON.stringify({ type: "waiting" }));
      }
    }

    if (data.type === "morse") {
      const room = rooms.get(ws.roomId);
      if (!room) return;

      room.answer = data.text;
      room.players.forEach(p =>
        p.send(JSON.stringify({
          type: "playMorse",
          morse: data.morse
          length: data.text.length
        }))
      );
    }

    if (data.type === "guess") {
      const room = rooms.get(ws.roomId);
      if (!room) return;

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

    if (ws.roomId && rooms.has(ws.roomId)) {
      const room = rooms.get(ws.roomId);
      room.players.forEach(p =>
        p.send(JSON.stringify({ type: "opponentLeft" }))
      );
      rooms.delete(ws.roomId);
    }
  });
});

console.log("✅ Morse Duel server running on port", PORT);
