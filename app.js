const express = require('express');
const socket = require('socket.io');
const crypto = require("crypto");
const http = require('http');
const { Chess } = require('chess.js');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socket(server);

let rooms = {};

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    let assignedRoom = null;

    for (let id in rooms) {
        if (!rooms[id].white || !rooms[id].black) {
            assignedRoom = id;
            break;
        }
    }

    if (assignedRoom === null) {
        assignedRoom = crypto.randomBytes(3).toString("hex");
        rooms[assignedRoom] = {
            white: null,
            black: null,
            spectators: [],
            game: new Chess()
        };
    }

    res.redirect(`/${assignedRoom}`);
});

app.get("/:roomID", (req, res) => {
    const roomID = req.params.roomID;
    if (rooms[roomID]) {
        res.render("gamePage", { title: "Chess Game", roomID });
    } else {
        res.redirect("/");
    }
});

io.on("connection", function (uniquesocket) {
    console.log("connected");

    uniquesocket.on("join-room", (roomID) => {
        const room = rooms[roomID];
        if (!room) return;

        if (!room.white) {
            room.white = uniquesocket.id;
            uniquesocket.emit("playerRole", "w");
            uniquesocket.emit("boardState", room.game.fen());
            console.log(`Player ${uniquesocket.id} assigned as White`);
        } else if (!room.black) {
            room.black = uniquesocket.id;
            uniquesocket.emit("playerRole", "b");
            uniquesocket.emit("boardState", room.game.fen());
            console.log(`Player ${uniquesocket.id} assigned as Black`);
        } else {
            room.spectators.push(uniquesocket.id);
            uniquesocket.emit("playerRole", "spectator");
            uniquesocket.emit("boardState", room.game.fen());
            console.log(`Player ${uniquesocket.id} joined as Spectator`);
        }

        uniquesocket.join(roomID);
        uniquesocket.roomID = roomID;

        if (room.white && room.black) {
            io.to(roomID).emit("start-game");
        }
    });

    uniquesocket.on("move", (move) => {
        const roomID = uniquesocket.roomID;
        const room = rooms[roomID];
    
        if (!room || !room.game) return;
    
        const result = room.game.move(move);
    
        if (result) {
            io.to(roomID).emit("move", result);
        } else {
            console.log(`Invalid move attempted: ${JSON.stringify(move)} by ${uniquesocket.id}`);
        }
    });
    
    uniquesocket.on("disconnect", function () {
        const roomID = uniquesocket.roomID;
        if (!roomID || !rooms[roomID]) return;

        let role;

        const room = rooms[roomID];
        if (room.white === uniquesocket.id) {
            role = "White";
            room.white = null;
            console.log("White disconnected");
        } else if (room.black === uniquesocket.id) {
            role = "Black";
            room.black = null;
            console.log("Black disconnected");
        } else {
            room.spectators = room.spectators.filter(id => id !== uniquesocket.id);
            console.log(`Spectator with the id ${uniquesocket.id} disconnected`);
        }

        io.to(roomID).emit("player-disconnected",role);

        if (!room.white && !room.black) {
            delete rooms[roomID];
            console.log(`Room ${roomID} deleted`);
        }

        room.game = new Chess();
    });
});

server.listen(3000, function () {
    console.log("Server running at http://localhost:3000");
});
