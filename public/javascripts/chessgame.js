const socket = io();
const chess = new Chess();
const boardElement = document.querySelector(".chessBoard");
let draggedPiece = null;
let sourceSquare = null;
let playerRole = null;
let disconnectToast = document.querySelector(".disconnectToast");
document.getElementById("roomLink").innerText = window.location.href;

const roomID = window.location.pathname.slice(1);

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

        const sourceSquareElem = boardElement.querySelector(sourceSelector);
        const targetSquareElem = boardElement.querySelector(targetSelector);

        const pieceElem = sourceSquareElem?.querySelector(".piece");

        if (pieceElem) {
            // Remove any piece on the target square (for captures)
            targetSquareElem.querySelector(".piece")?.remove();

            // Move the piece to the target square
            targetSquareElem.appendChild(pieceElem);
        }

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
    const link = window.location.href;

    navigator.clipboard.writeText(link).then(() => {
        const toast = document.getElementById("toast");
        toast.classList.remove("opacity-0");

        setTimeout(() => {
            toast.classList.add("opacity-0");
        }, 2000);
    }).catch(() => {
        alert("Failed to copy the link.");
    });
}
