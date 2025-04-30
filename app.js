const express = require('express');
const app = express();
const socket = require('socket.io');
const crypto = require("crypto");
const http = require('http');
const { Chess } = require('chess.js');
const path = require('path');
const userModel = require('./models/user');
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const session = require('express-session');
const flash = require('express-flash');
const cookieParser = require('cookie-parser');
const server = http.createServer(app);
const io = socket(server);
const connectDB = require('./db');

let rooms = {};

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'a0s8d1u2h18h1h28g19h8g1h',
    resave: false,
    saveUninitialized: false
}));
app.use(flash());
app.use(cookieParser());

app.get('/favicon.ico', (req, res) => res.status(204).end());

app.get("/", redirectIfLoggedIn, (req, res) => {
    res.render("index", { info: req.flash('info') });
});

app.get("/login", redirectIfLoggedIn, (req, res) => {
    // const token = req.cookies.token;
    // console.log("Login route accessed, token exists:", !!token);

    // if (!token) {
    //     return res.render("login", { info: req.flash('info') });
    // }

    // try {
    //     const decoded = jwt.verify(token, "a0s8d1u2h18h1h28g19h8g1h");
    //     console.log("Valid token on login page, redirecting to dashboard");
    //     req.flash("info", "You're already logged in. Logout to access this feature");
    //     return res.redirect("/dashboard");
    // } catch (err) {
    //     console.log("Invalid token on login page:", err.message);
    //     res.clearCookie('token');
    //     return res.render("login", { info: req.flash('info') });
    // }

    res.render("login", { info: req.flash('info') });
});

app.get("/signup", redirectIfLoggedIn, (req, res) => {
    res.render("signup", { info: req.flash('info') });
});

app.get("/dashboard", isLoggedIn, async (req, res) => {
    try {
        const token = req.cookies.token;

        if (!token) {
            return res.redirect("/login");
        }

        const decodedCookie = jwt.verify(token, "a0s8d1u2h18h1h28g19h8g1h");
        const user = await userModel.findOne({ email: decodedCookie.email });

        if (!user) {
            return res.redirect("/login");
        }

        const name = user.name;
        res.render("dashboard", { info: req.flash('info'), success: req.flash("success"), name });

    } catch (err) {
        console.error("Error in dashboard route:", err.message);
        res.redirect("/login");
    }
});

app.get("/logout", isLoggedIn, (req, res) => {
    // console.log("EXPLICIT LOGOUT REQUESTED FROM:", req.get('Referer') || 'unknown');
    res.clearCookie('token');
    req.flash('info', 'You have been logged out successfully');
    return res.redirect("/");
});

app.post("/login", async (req, res) => {
    let { email, password } = req.body;
    let user = await userModel.findOne({ email });

    if (!user) {
        req.flash('info', 'Invalid email or password');
        return res.redirect('/login');
    };

    bcrypt.compare(password, user.password, (err, result) => {
        if (result) {
            req.flash('success', 'Logged In Successfully')
            let token = jwt.sign({ userid: user._id, email }, "a0s8d1u2h18h1h28g19h8g1h", { expiresIn: '1h' });
            res.cookie('token', token, { maxAge: 3600000 });
            res.redirect("/dashboard");
        }
        else {
            req.flash('info', 'Invalid email or password');
            res.redirect('/login');
        }
    })
});

app.post("/signup", async (req, res) => {
    let { name, email, password } = req.body;
    let user = await userModel.findOne({ email });
    if (user) {
        req.flash('info', 'User already registered');
        return res.redirect("/signup");
    }
    let hash = await bcrypt.hash(password, 10);

    user = await userModel.create({
        name,
        email,
        password: hash
    });

    let token = jwt.sign({ userid: user._id, email }, "a0s8d1u2h18h1h28g19h8g1h", { expiresIn: '1h' });
    res.cookie('token', token, { maxAge: 3600000 });
    req.flash("success", "Account Created Succesfully")
    res.redirect("/dashboard");
});

app.get("/createRoom", isLoggedIn, (req, res) => {
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

app.get("/joinRoom", isLoggedIn, (req, res) => {
    res.render("joinRoom", { info: req.flash("info") });
})

app.post("/joinRoom", (req, res) => {
    let { roomID } = req.body;
    res.redirect(`/${roomID}`);
});

app.get("/:roomID", isLoggedIn, (req, res) => {
    const roomID = req.params.roomID;
    if (rooms[roomID]) {
        res.render("gamePage", { title: "Chess Game", roomID });
    } else {
        req.flash("info", "Room doesnt exist");
        res.redirect("/joinRoom");
    }
});

io.on("connection", function (uniquesocket) {
    // console.log("connected");

    uniquesocket.on("join-room", (roomID) => {
        const room = rooms[roomID];
        if (!room) return;

        uniquesocket.join(roomID);
        uniquesocket.roomID = roomID;

        if (!room.white && !room.black) {
            const random = Math.random();
            // console.log(`Random number: ${random}`);
            if (random < 0.5) {
                room.white = uniquesocket.id;
                uniquesocket.emit("playerRole", "w");
            }

            else {
                room.black = uniquesocket.id;
                uniquesocket.emit("playerRole", "b");
            }
        }

        else if (!room.white) {
            room.white = uniquesocket.id;
            uniquesocket.emit("playerRole", "w");
            // console.log(`Player ${uniquesocket.id} assigned as White`);
        } else if (!room.black) {
            room.black = uniquesocket.id;
            uniquesocket.emit("playerRole", "b");
            // console.log(`Player ${uniquesocket.id} assigned as Black`);
        } else {
            room.spectators.push(uniquesocket.id);
            uniquesocket.emit("playerRole", "spectator");
            // console.log(`Player ${uniquesocket.id} joined as Spectator`);
        }


        uniquesocket.emit("boardState", room.game.fen());

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
            // console.log("White disconnected");
        } else if (room.black === uniquesocket.id) {
            role = "Black";
            room.black = null;
            // console.log("Black disconnected");
        } else {
            room.spectators = room.spectators.filter(id => id !== uniquesocket.id);
            // console.log(`Spectator with the id ${uniquesocket.id} disconnected`);
        }

        io.to(roomID).emit("player-disconnected", role);

        if (!room.white && !room.black) {
            delete rooms[roomID];
            // console.log(`Room ${roomID} deleted`);
        }

        room.game = new Chess();
    });
});

async function startServer() {
    const db = await connectDB();

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
}

startServer();

function isLoggedIn(req, res, next) {
    const token = req.cookies.token;
    // console.log(`[${req.path}] isLoggedIn check:`, !!token);

    if (!token) {
        req.flash('info', 'You must be logged in to access this feature');
        return res.redirect("/login");
    }

    try {
        const data = jwt.verify(token, "a0s8d1u2h18h1h28g19h8g1h");
        // console.log(`[${req.path}] isLoggedIn verified:`, data.email);
        req.user = data;
        return next();
    } catch (err) {
        // console.log(`[${req.path}] isLoggedIn token error:`, err.message);
        // This is where invalid tokens should be cleared
        res.clearCookie('token');
        req.flash('info', 'Your session expired Please login again.');
        return res.redirect("/login");
    }
}

function redirectIfLoggedIn(req, res, next) {
    const token = req.cookies.token;
    // console.log(`[${req.path}] Token check:`, !!token);

    if (!token) {
        return next();
    }

    try {
        const decoded = jwt.verify(token, "a0s8d1u2h18h1h28g19h8g1h");
        // console.log(`[${req.path}] Valid token for:`, decoded.email);

        // Skip redirects for specific routes
        if (req.path === '/logout') {
            // console.log("Allowing access to logout route");
            return next();
        }

        // Redirect with flash message
        req.flash("info", "You're already logged in. Logout to access this feature");
        return res.redirect("/dashboard");
    } catch (err) {
        // console.log(`[${req.path}] Token verification failed:`, err.message);
        res.clearCookie('token');
        return next();
    }
}