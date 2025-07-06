"use strict";
import { Board } from "./components/board.js";
import { serverAddress, socketAddress } from "./resources.js";
import { Player } from "./player.js";
import { myToken, myId } from "./auth.js";
import { DataReader, DataWriter } from "dataproto";
import { confetti } from "@tsparticles/confetti";

const gameScreen = /**@type {HTMLElement}*/(document.getElementById("gameScreen"));
const chatInput = /**@type {HTMLInputElement}*/(document.getElementById("chatInput"));
const board = /**@type {Board}*/(document.getElementById("board"));
const exitMatchButton = /**@type {HTMLElement}*/(document.getElementById("exitMatchButton"));
const boardPosition = /**@type {HTMLElement}*/(document.getElementById("boardPosition"));
const boardCanvas = /**@type {HTMLCanvasElement}*/(document.getElementById("boardCanvas"));
const gamemodeTitle = /**@type {HTMLElement}*/(document.getElementById("gamemodeTitle"));
const gamemodesPanel = /**@type {HTMLElement}*/(document.getElementById("gamemodesPanel"));
const chatPanel = /**@type {HTMLElement}*/(document.getElementById("chatPanel"));
const chatMessages = /**@type {HTMLElement}*/(document.getElementById("chatMessages"));
const settingsPanel = /**@type {HTMLElement}*/(document.getElementById("settingsPanel"));
const turnPanel = /**@type {HTMLElement}*/(document.getElementById("turnPanel"));
const turnProgress = /**@type {HTMLElement}*/(document.getElementById("turnProgress"));
const turnLabel = /**@type {HTMLElement}*/(document.getElementById("turnLabel"));
const takenPiecesPanel = /**@type {HTMLElement}*/(document.getElementById("takenPiecesPanel"));
const takenPieces = /**@type {HTMLElement}*/(document.getElementById("takenPieces"));
const promotionPanel = /**@type {HTMLElement}*/(document.getElementById("promotionPanel"));
const promotionPieces = /**@type {HTMLElement}*/(document.getElementById("promotionPieces"));
const meTurnPopup = /**@type {HTMLElement}*/(document.getElementById("meTurnPopup"));
const rulesetPanel = /**@type {HTMLElement}*/(document.getElementById("rulesetPanel"));
const matchRules = /**@type {HTMLElement}*/(document.getElementById("matchRules"));
const deathMenu = /**@type {HTMLElement}*/(document.getElementById("deathMenu"));

const outgoingCodes = {
	pieceMoves: 0,
	move: 1,
	promote: 2
};

const incomingCodes = {
	matchInfo: 0,
	playerInfo: 1,
	currentTurn: 2,
	pieceMoves: 3,
	move: 4,
	take: 5,
	availablePromotion: 6,
	promote: 7
};

// Utils
/**
 * @param {Board} boardElement
 * @param {HTMLCanvasElement|null} confettiCanvas
 * @param {Function|null} confetti
 * @param {number} column
 * @param {number} row
 */
export function animateDestroyPiece(boardElement, confettiCanvas = null, confetti = null, column = 0, row = 0) {
	if (confettiCanvas && localStorage.effects === "true") {
		const pieceClone = boardElement.pieceElements[column][row].cloneNode(true);
		boardElement.board.appendChild(pieceClone);
		pieceClone.style.setProperty('--piece-fill', 'red');
		pieceClone.animate([
			{ transform: 'scale(1.8) rotate(10deg)', opacity: 0 },
		], {
			duration: 1000,
			fill: 'forwards',
			iterations: 1,
		});
		setTimeout(() => pieceClone.remove(), 1000);
		const canvBounds = confettiCanvas.getBoundingClientRect();
		const pieceBounds = pieceClone.getBoundingClientRect();
		const tileSize = boardElement.getTileSize();
		if (confetti) {
			confetti({
				spread: 360,
				gravity: 1,
				particleCount: 50,
				startVelocity: 10,
				shapes: ['text'],
				shapeOptions: {
					text: {
						value: ['💥', '🔥', '🔴'],
					}
				},
				origin: {
					x: (pieceBounds.left - canvBounds.left + tileSize / 2) / confettiCanvas.offsetWidth,
					y: (pieceBounds.top - canvBounds.top + tileSize / 2) / confettiCanvas.offsetHeight
				},
			});
		}
	}

	boardElement.clearPiece(column, row);
}

/**@typedef {{ condition: string, action: any }} RulesetRule*/

/**@param {RulesetRule} rule*/
function createRulesetElement(rule) {
	// Keyword part (WHEN)
	const rulesetEl = document.createElement("div");
	const keywordEl = document.createElement("span");
	keywordEl.textContent = "WHEN ";
	keywordEl.dataset.kind = "keyword";
	rulesetEl.appendChild(keywordEl);

	// Condition for ruleset rule
	const conditionEl = document.createElement("span");
	switch (rule.condition) {
		case "matchStart":
			conditionEl.textContent = "the match starts ";
			break;
		case "pieceKilled":
			conditionEl.textContent = "a piece is killed ";
			break;
		case "pawnPromoted":
			conditionEl.textContent = "a pawn is promoted ";
			break;
		case "blackInCheck":
			conditionEl.textContent = "a black is in check ";
			break;
		case "whiteInCheck":
			conditionEl.textContent = "a white is in check ";
			break;
	}
	conditionEl.dataset.layer = "true";
	rulesetEl.appendChild(conditionEl);

	// Action string part of ruleset rule
	const actionEl = document.createElement("span");
	switch (rule.action.type) {
		case "spawn":
			actionEl.textContent =
				`spawn ${rule.action.atColour} ${rule.action.atType} at ${rule.action.atPosition}`;
			break
		case "delete":
			actionEl.textContent =
				`the piece at ${rule.action.atPosition} will be deleted`;
			break
		case "setCurrentTurn":
			actionEl.textContent =
				`the current turn will be ${rule.action.turnColour}`;
			break
	}
	rulesetEl.appendChild(actionEl);
	return rulesetEl;
}

/**@type {WebSocket|null}*/let socket = null;

/** @param {number} matchId */
export function play(matchId) {
	return new Promise(async (resolve, reject) => {
		if (!myToken) {
			throw new Error("Unauthorised");
		}

		// Make HTTP request beforehand to check if the specified match exists / is authorised
		const res = await fetch(`${serverAddress}/Matches/${matchId}?authorization=${myToken}`, {
			method: "GET",
			headers: { Authorization: myToken }
		});
		if (!res.ok) {
			const message = (await res.json())?.message;
			alert("Could not join match - " + (message || "network error"));
			return;
		}

		/**@type {number|null}*/let myTurn = null;
		/**@type {number|null}*/let currentTurn = null;
		/**@type {number|null}*/let turnStart = null;
		/**@type {number|null}*/let turnDuration = null;
		/**@type {number}*/let playerCount = 0;
		/**@type {Player[]} players*/let players = [];

		// When a piece of ours is clicked, we need to ask the server for possible moves
		board.onpiececlick = function(e, column, row, pieceElement) {
			if (!socket) {
				return;
			}

			const myColour = players[myTurn].colour;
			const pieceData = board.pieces[column][row];
			if (myColour !== pieceData?.colour) {
				return;
			}

			board.clearMoveIndicators();
			const movesPacket = new DataWriter();
			movesPacket.uint8(outgoingCodes.pieceMoves);
			movesPacket.uint8(column);
			movesPacket.uint8(row);
			socket.send(movesPacket.build());
		}

		board.onmoveclick = function(e, column, row, moveElement) {
			if (!board.selected || !socket) {
				return;
			}
			const movePacket = new DataWriter();
			movePacket.uint8(outgoingCodes.move);
			movePacket.uint8(board.selected.column);
			movePacket.uint8(board.selected.row);
			movePacket.uint8(column);
			movePacket.uint8(row);
			socket.send(movePacket.build());
		}

		const matchInfo = await res.json();
		turnLabel.textContent = `"${matchInfo.name}" | Match ID: ${matchId}`;
		socket = new WebSocket(`${socketAddress}/Matches/${matchId}?authorization=${myToken}`);
		socket.binaryType = "arraybuffer";
		socket.onopen = function() {
			console.log(`Connection to match instance ${matchId} opened`);
			board.setTheme(localStorage.boardTheme);
			resolve(socket);
		}
		socket.onmessage = function({ data }) {
			if (data instanceof ArrayBuffer) {
				const packet = new DataReader(data);
				// Packet code
				const code = packet.uint8();
				switch (code) {
					case incomingCodes.matchInfo: {
						const columns = packet.uint8();
						const rows = packet.uint8();
						board.columns = columns;
						board.rows = rows;
						const rulesetId = packet.uint32();
						const arrangementId = packet.uint32();
						async function loadRulesetArrangement() {
							if (myToken == null) {
								throw new Error("Unauthorised");
							}

							const rulesetResponse = await fetch(`${serverAddress}/Rulesets/${rulesetId}`, {
								method: "GET",
								headers: { "Content-Type": "application/json", Authorization: myToken },
							});
							if (!rulesetResponse.ok) {
								const message = (await rulesetResponse.json())?.message;
								alert(`Could not find match ruleset ${rulesetId}, ${message || "network error"}`);
								socket?.close();
								return;
							}
							else {
								const rulesetObject = await rulesetResponse.json();
								const rules = JSON.parse(rulesetObject.data);
								for (let rule of rules) {
									const ruleEl = createRulesetElement(rule);
									matchRules.appendChild(ruleEl);
								}
							}
							const arrangementResponse = await fetch(`${serverAddress}/Arrangements/${arrangementId}`, {
								method: "GET",
								headers: { "Content-Type": "application/json", Authorization: myToken },
							});
							if (!arrangementResponse.ok) {
								const message = (await arrangementResponse.json())?.message;
								alert(`Could not find match arrangement ${arrangementId}, ${message || "network error"}`);
								socket?.close();
								return;
							}
							else {
								const arrangementObject = await arrangementResponse.json();
								const arrangement = JSON.parse(arrangementObject.data);

								for (let r = 0; r < board.columns; r++) {
									for (let c = 0; c < board.rows; c++) {
										const index = r * board.columns + c
										if (!arrangement[index]) {
											continue;
										}
										board.setPiece(c, r, arrangement[index]);
									}
								}
							}
						}
						loadRulesetArrangement();
						break;
					}
					case incomingCodes.playerInfo: {
						playerCount = packet.uint8();
						players = [];
						for (let i = 0; i < playerCount; i++) {
							const accountId = packet.uint32();
							const colour = packet.string();
							const player = new Player(i, accountId, colour);
							players.push(player);
							if (accountId == myId) {
								myTurn = i;
								board.rotateBoard(colour);
							}
							async function loadPlayerProfile() {
								const profileResponse = await fetch(`${serverAddress}/Profiles/${accountId}`, {
									method: "GET",
									headers: { "Content-Type": "application/json", },
								});
								if (!profileResponse.ok) {
									const message = (await profileResponse.json())?.message;
									console.error(`Could not find profile for user ${accountId}, ${message || "network error"}`);
								}
								else {
									const user = await profileResponse.json();
									player.profile = user;
								}
							}
							loadPlayerProfile();
						}
						break;
					}
					case incomingCodes.currentTurn: {
						currentTurn = packet.uint8();
						turnDuration = packet.uint32();
						turnStart = Date.now();
						const currentPlayer = players[currentTurn];
						const playerName = currentPlayer.profile?.username
							? `(${currentPlayer.profile?.username}) `
							: "";
						if (currentTurn !== myTurn) {
							turnLabel.textContent = `Current turn: ${currentTurn + 1} ${playerName}| Your turn is ${myTurn + 1}`;
							board.clearMoveIndicators();
						}
						else {
							turnLabel.textContent = `It's currently your turn (turn ${currentTurn + 1})`;
						}
						turnProgress.animate([
							{ width: "100%" },
							{ width: "0%" }
						], {
							duration: turnDuration,
							iterations: 1
						});
						board.clearHighlights();
						promotionPanel.dataset.closed = "true";
						break
					}
					case incomingCodes.pieceMoves: {
						const count = packet.uint16();
						for (let i = 0; i < count; i++) {
							const column = packet.uint8();
							const row = packet.uint8();
							board.addMoveIndicator(column, row);
						}
						break;
					}
					case incomingCodes.move: {
						const pieceColumn = packet.uint8();
						const pieceRow = packet.uint8();
						const toColumn = packet.uint8();
						const toRow = packet.uint8();
						board.movePiece(pieceColumn, pieceRow, toColumn, toRow);
						board.clearMoveIndicators();
						break
					}
					case incomingCodes.take: {
						const takenColumn = packet.uint8();
						const takenRow = packet.uint8();
						const takerTurn = packet.uint8();
						if (takerTurn === myTurn) {
							const pieceData = board.pieces[takenColumn][takenRow];
							const pieceEl = document.createElement("img");
							pieceEl.classList.add("piece-draggable");
							pieceEl.src = `resources/${pieceData.type}-${pieceData.colour}.svg`;
							pieceEl.width = 72;
							pieceEl.height = 72;
							takenPieces.appendChild(pieceEl);
						}
						animateDestroyPiece(board, boardCanvas, boardCanvasConfetti, takenColumn, takenRow);
						break;
					}
					case incomingCodes.availablePromotion: {
						const promotedColumn = packet.uint8();
						const promotedRow = packet.uint8();
						board.addHighlight(promotedColumn, promotedRow);

						// Show promotion panel with all promotable pieces
						delete promotionPanel.dataset.closed;
						while (promotionPieces.lastElementChild) {
							promotionPieces.removeChild(promotionPieces.lastElementChild);
						}
						const myColour = players[myTurn].colour;
						const possiblePromotions = ["rook", "knight", "bishop", "queen"];
						for (const type of possiblePromotions) {
							const pieceButton = document.createElement("button");
							pieceButton.addEventListener("click", function() {
								const promotePacket = new DataWriter();
								promotePacket.uint8(outgoingCodes.promote);
								promotePacket.uint8(promotedColumn);
								promotePacket.uint8(promotedRow);
								promotePacket.string(type);
								socket?.send(promotePacket.build());
							})
							const pieceEl = document.createElement("img");
							pieceEl.src = `resources/${type}-${myColour}.svg`;
							pieceEl.width = 72;
							pieceEl.height = 72;
							pieceButton.appendChild(pieceEl);
							promotionPieces.appendChild(pieceButton);
						}
						break;
					}
					case incomingCodes.promote: {
						const column = packet.uint8();
						const row = packet.uint8();
						const toType = packet.string();
						const pieceData = board.pieces[column][row];
						// Replace piece with promoted type
						board.clearPiece(column, row);
						pieceData.type = toType;
						board.setPiece(column, row, pieceData);
						break;
					}
				}
			}
			else if (typeof data === "string") {
				const jsonData = JSON.parse(data);

				let cachedProfile = null;
				for (const player of players) {
					if (player.accountId == jsonData.userId) {
						cachedProfile = player.profile;
					}
				}
				let displayUsername = cachedProfile?.username || "#" + jsonData.userId;

				// Create chat message item and add to UI
				const chatItemEl = document.createElement("p");
				const nameEl = document.createElement("button");
				nameEl.title = "View profile";
				nameEl.className = "chat-name-button";
				nameEl.textContent = `[${displayUsername}]`;
				if (cachedProfile) {
					nameEl.onclick = async function() {
						const profileView = /**@type {ProfileView}*/(document.createElement("ac-profile-view"));
						profileView.style.left = "50%";
						profileView.style.top = "50%";
						profileView.style.transform = "translateY(-50%)";
						chatItemEl.appendChild(profileView);
						profileView.loadFromData(cachedProfile);
					}
				}
				chatItemEl.appendChild(nameEl);
				const messageEl = document.createElement("span");
				messageEl.textContent = jsonData.message;
				chatItemEl.appendChild(messageEl);
				chatMessages.appendChild(chatItemEl);

				//  If already near bottom, scroll so new chat message is visible
				if (chatMessages.scrollHeight - chatMessages.scrollTop < 64) {
					chatMessages.scroll({
						top: chatMessages.scrollHeight,
						left: 0,
						behavior: "smooth",
					});
				}
			}
		}
		socket.onclose = function(event) {
			alert(event.reason || "Match ended");
			window.location.reload();
			reject(event);
		}
		socket.onerror = function(event) {
			alert(event || "Match ended");
			window.location.reload();
			reject(event);
		}
	});
}

exitMatchButton.addEventListener("click", function() {
	socket?.close();
});

chatInput.addEventListener("keydown", function(e) {
	if (e.key == "Enter" && socket != null) {
		socket.send(chatInput.value);
		chatInput.value = "";
	}
});


const boardPointerTargets = [gameScreen, board, boardPosition];
/** @param {WheelEvent} event */
function handleBoardZoom(event) {
	if (!(event.target instanceof HTMLElement) || !boardPointerTargets.includes(event.target)) {
		return;
	}

	let z = parseFloat(boardPosition.dataset.z ?? "1");
	z = Math.max(0.5, Math.min(z + (event.deltaY < 0 ? 0.1 : -0.1), 1.5));
	boardPosition.dataset.z = String(z);
	const transformX = -parseFloat(boardPosition.dataset.x ?? "0");
	const transformY = -parseFloat(boardPosition.dataset.y ?? "0");
	boardPosition.style.transform = `translate(${transformX}px, ${transformY}px) scale(${z})`;
	event.preventDefault(); // only if needed
}
gameScreen.addEventListener("wheel", handleBoardZoom, { passive: false });

/**@type {{ x:number, y:number }|null} lastTouch*/let lastTouch = null;

gameScreen.addEventListener("touchstart", (e) => {
	if (e.touches.length === 1) {
		lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
	}
});

/** @param {MouseEvent | TouchEvent} event */
function handleBoardDrag(event) {
	if (boardPosition.dataset.dragging !== "true") {
		return;
	}

	gameScreen.style.cursor = "grabbing";

	let x = parseFloat(boardPosition.dataset.x ?? "0");
	let y = parseFloat(boardPosition.dataset.y ?? "0");
	let z = parseFloat(boardPosition.dataset.z ?? "1");

	if (!Number.isFinite(x)) {
		x = 0;
	}
	if (!Number.isFinite(y)) {
		y = 0;
	}
	if (!Number.isFinite(z) || z === 0) {
		z = 1;
	}

	let dx = 0;
	let dy = 0;
	if (event instanceof MouseEvent) {
		dx = event.movementX;
		dy = event.movementY;
	}
	else if (event instanceof TouchEvent && event.touches.length === 1 && lastTouch) {
		const touch = event.touches[0];
		dx = touch.clientX - lastTouch.x;
		dy = touch.clientY - lastTouch.y;
		lastTouch = { x: touch.clientX, y: touch.clientY }; // update for next move
	}
	else {
		return; // ignore multi-touch or untrackable
	}

	x = Math.max(0, Math.min(x - dx / z, 1000));
	y = Math.max(0, Math.min(y - dy / z, 1000));

	boardPosition.dataset.x = String(x);
	boardPosition.dataset.y = String(y);

	const offset = (1 - z) * 500;
	const transformX = -(x * z + offset);
	const transformY = -(y * z + offset);

	boardPosition.dataset.tx = String(transformX);
	boardPosition.dataset.ty = String(transformY);
	boardPosition.style.transform = `translate(${transformX}px, ${transformY}px) scale(${z})`;

	event.preventDefault(); // needed for touch scroll block
}
gameScreen.addEventListener("mousemove", handleBoardDrag);
gameScreen.addEventListener("touchmove", handleBoardDrag, { passive: false });


/**
 * @param {Event} event 
 */
function handleBoardPress(event) {
	if (!(event.target instanceof HTMLElement)
		|| !boardPointerTargets.includes(event.target)) {
		return;
	}
	boardPosition.dataset.dragging = "true";
	boardPosition.style.willChange = "transform";
}
gameScreen.addEventListener("mousedown", handleBoardPress);
gameScreen.addEventListener("touchstart", handleBoardPress);

function handleBoardRelease() {
	boardPosition.dataset.dragging = "false";
	gameScreen.style.cursor = "default";
	boardPosition.style.willChange = "auto";
}
gameScreen.addEventListener("mouseup", handleBoardRelease);
gameScreen.addEventListener("touchend", handleBoardRelease);

/**@type {Function|null}*/let boardCanvasConfetti = null;
confetti.create(boardCanvas, { }).then(confetti => {
	boardCanvasConfetti = confetti;
})

