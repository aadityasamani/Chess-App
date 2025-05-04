const socket = io();
const chess = new Chess();
const boardElement = document.querySelector(".chessBoard");
let draggedPiece = null;
let sourceSquare = null;
let lastMove = null;
let playerRole = null;
let disconnectToast = document.querySelector(".disconnectToast");

const roomID = window.location.pathname.slice(1);
document.getElementById("roomLink").innerText = roomID;

socket.emit("join-room", roomID);

socket.on("start-game", () => {
    document.getElementById("waitingScreen").classList.add("hidden");
    document.getElementById("chessContainer").classList.remove("hidden");
    renderBoard();
});

const renderBoard = () => {
    boardElement.innerHTML = "";
    const board = chess.board();

    board.forEach((row, rowIndex) => {
        row.forEach((square, squareIndex) => {
            const squareElement = document.createElement("div");
            squareElement.classList.add("square", (rowIndex + squareIndex) % 2 === 0 ? "light" : "dark");
            squareElement.dataset.row = rowIndex;
            squareElement.dataset.col = squareIndex;

            squareElement.style.width = (boardElement.clientWidth / 8) + "px";
            squareElement.style.height = (boardElement.clientHeight / 8) + "px";


            if (square) {
                const pieceElement = document.createElement("div");
                pieceElement.classList.add("piece", square.color === "w" ? "white" : "black");

                const pieceImg = document.createElement("img");
                pieceImg.src = getPieceImageSrc(square);
                pieceImg.alt = `${square.color}${square.type}`;
                pieceImg.draggable = false;
                pieceImg.classList.add("piece-img");

                pieceElement.appendChild(pieceImg);

                pieceElement.draggable = playerRole === square.color;

                pieceElement.addEventListener("dragstart", (e) => {
                    if (pieceElement.draggable) {
                        draggedPiece = pieceElement;
                        sourceSquare = { row: rowIndex, col: squareIndex };
                        e.dataTransfer.setData("text/plain", "");
                    }
                });

                pieceElement.addEventListener("dragend", () => {
                    draggedPiece = null;
                    sourceSquare = null;
                });

                squareElement.appendChild(pieceElement);
            }

            squareElement.addEventListener("dragover", (e) => {
                e.preventDefault();
            });

            squareElement.addEventListener("drop", (e) => {
                e.preventDefault();
                if (draggedPiece) {
                    const targetSource = {
                        row: parseInt(squareElement.dataset.row),
                        col: parseInt(squareElement.dataset.col)
                    };

                    handleMove(sourceSquare, targetSource);
                }
            });
            boardElement.append(squareElement);
        });
    });

    document.querySelectorAll(".square").forEach(square => {
        square.style.backgroundColor = "";
    });

    if (lastMove) {
        const sourceSelector = `[data-row="${lastMove.source.row}"][data-col="${lastMove.source.col}"]`;
        const targetSelector = `[data-row="${lastMove.target.row}"][data-col="${lastMove.target.col}"]`;
    
        const sourceSquareElem = boardElement.querySelector(sourceSelector);
        const targetSquareElem = boardElement.querySelector(targetSelector);
    
        if (sourceSquareElem) sourceSquareElem.style.backgroundColor = "#f3f326";
        if (targetSquareElem) targetSquareElem.style.backgroundColor = "#f3f326";
    }
    

    if (playerRole === "b") {
        boardElement.classList.add("flipped");
    } else {
        boardElement.classList.remove("flipped");
    }
};

const handleMove = (source, target) => {
    const move = {
        from: `${String.fromCharCode(97 + source.col)}${8 - source.row}`,
        to: `${String.fromCharCode(97 + target.col)}${8 - target.row}`,
        promotion: "q"
    };

    const result = chess.move(move);

    if (result) {
        // Instead of full re-render, move the DOM element manually
        const sourceSelector = `[data-row="${source.row}"][data-col="${source.col}"]`;
        const targetSelector = `[data-row="${target.row}"][data-col="${target.col}"]`;

        lastMove = { source, target }
        const sourceSquareElem = boardElement.querySelector(sourceSelector);
        const targetSquareElem = boardElement.querySelector(targetSelector);

        const pieceElem = sourceSquareElem?.querySelector(".piece");

        if (pieceElem) {
            // Remove any piece on the target square (for captures)
            targetSquareElem.querySelector(".piece")?.remove();

            // Move the piece to the target square
            targetSquareElem.appendChild(pieceElem);
        }

        sourceSquareElem.style.backgroundColor = "yellow";
        targetSquareElem.style.backgroundColor = "yellow";
        // Send move to server
        socket.emit("move", move);
    }
};

const getPieceImageSrc = (piece) => {
    if (!piece) return "";
    const colorPrefix = piece.color === "w" ? "w" : "b";
    const type = piece.type.toUpperCase();
    return `./images/pieces/${colorPrefix}${type}.svg`;
};

socket.on("playerRole", function (role) {
    playerRole = role;
    renderBoard();
});

socket.on("spectatorRole", function () {
    playerRole = null;
    renderBoard();
});

socket.on("boardState", function (fen) {
    chess.load(fen);
    renderBoard();
});

socket.on("move", function (move) {
    chess.move(move);
    const source = {
        row: 8 - parseInt(move.from[1]),
        col: move.from.charCodeAt(0) - 97
    };
    const target = {
        row: 8 - parseInt(move.to[1]),
        col: move.to.charCodeAt(0) - 97
    };
    lastMove = { source, target };
    renderBoard();
});

socket.on("player-disconnected", (role) => {
    disconnectToast.innerText = `${role} player disconnected, Resetting The Board..`;
    disconnectToast.classList.remove("opacity-0");
    setTimeout(() => {
        disconnectToast.classList.add("opacity-0");
    }, 3000);

    setTimeout(() => {
        chess.reset();
        renderBoard();
    }, 3500);
});

renderBoard();

function copyLink() {

    navigator.clipboard.writeText(roomID).then(() => {
        const toast = document.getElementById("toast");
        toast.classList.remove("opacity-0");

        setTimeout(() => {
            toast.classList.add("opacity-0");
        }, 2000);
    }).catch(() => {
        alert("Failed to copy the roomID.");
    });
}