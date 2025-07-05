"use strict";
import { defineAndInject } from "./component-registrar.js"
import { createPieceSvgElement } from "../resources.js"
import { PieceData } from "../piece-data.js";

/**@typedef {{row: number, column: number}} BoardSelection*/

export class Board extends HTMLElement {
	/**@type {(PieceData|null)[][]}*/#pieces = []
	/**@type {(SVGElement|null)[][]}*/#pieceElements = []
	/**@type {(HTMLElement|null)[][]}*/#moveElements = []
	/**@type {(HTMLElement|null)[][]}*/#highlightElements = []
	/**@type {(HTMLElement|null)[][]}*/#tileElements = []
	/**@type {number}*/#rows
	/**@type {number}*/#columns
	/**@type {string}*/#playingSide
	/**@type {HTMLAudioElement}*/#selectAudio
	/**@type {HTMLAudioElement}*/#deleteAudio
	/**@type {number}*/turn
	/**@type {BoardSelection|null}*/selected
	/**@type {HTMLElement|null}*/board

	constructor() {
		super()
		this.#rows = parseInt(this.getAttribute("rows") ?? "0") || 8
		this.#columns = parseInt(this.getAttribute("columns") ?? "0") || 8
		this.#playingSide = "white"
		this.#selectAudio = new Audio("resources/select-pop.mp3")
		this.#deleteAudio = new Audio("resources/delete-break.mp3")
		this.turn = 0
		this.selected = null
		this.board = null
		this.resetAll()

		/**@type {((e: Event, c:number, r:number, t:HTMLElement)=>void)|null}*/this.ontilehover = null
		/**@type {((e: Event, c:number, r:number, t:HTMLElement)=>void)|null}*/this.ontiledrop = null
		/**@type {((e: Event, c:number, r:number, t:HTMLElement)=>void)|null}*/this.ontileleave = null
		/**@type {((e: Event, c:number, r:number, t:HTMLElement)=>void)|null}*/this.onmoveclick = null
		/**@type {((e: Event, c:number, r:number, p:SVGElement)=>void)|null}*/this.onpiececlick = null
		this.attachShadow({ mode: "open" })
	}

	get tileElements() {
		return this.#tileElements
	}
	get pieceElements() {
		return this.#pieceElements
	}
	get pieces() {
		return this.#pieces
	}
	get moveElements() {
		return this.#moveElements
	}
	static get observedAttributes() {
		return ["rows", "columns"]
	}
	// TODO: Consider if attribute needs update
	get columns() {
		return this.#columns
	}
	set columns(value) {
		this.#columns = value
		this.resetAll()
		this.flushBoard()
	}
	get rows() {
		return this.#rows
	}
	set rows(value) {
		this.#rows = value
		this.resetAll()
		this.flushBoard()
	}

	/**
	 * @param {string} name - The name of the attribute.
	 * @param {string} oldValue - The old value of the attribute.
	 * @param {string} newValue - The new value of the attribute.
	 */
	attributeChangedCallback(name, oldValue, newValue) {
		if (name === "rows" || name === "columns") {
			if (this.board == null) {
				return
			}

			const value = parseInt(newValue)
			if (isNaN(value)) {
				return
			}
			this[name] = value
			this.flushBoard()
		}
		if (name === "theme") {
			this.setTheme(newValue)
		}
	}

	connectedCallback() {
		if (!this.shadowRoot) {
			throw new Error("Shadow root not found")
		}
		this.shadowRoot.innerHTML = `
			<div id="board" class="board-container"></div>
		`
		const style = document.createElement("style")
		style.innerHTML = `
			:host {
				width: 100%;
				--columns: 8;
				--rows: 8;
				--white: #fff;
				--black: #000;
			}
			* {
				box-sizing: border-box;
			}
			.board-container {
				border: 1px solid gray;
				display: grid;
				grid-template-columns: repeat(var(--columns), 1fr);
				grid-template-rows: repeat(var(--rows), 1fr);
				width: 100%;
				position: relative;
			}
			.tile {
				user-select: none;
				aspect-ratio: 1/1;
				transition: 0.1s filter;
			}
			.tile:hover {
				filter: brightness(1.5) contrast(0.6) invert(0.2);
			}
			.tile-black {
				background: var(--black);
			}
			.tile-white {
				background: var(--white);
			}
			.highlight {
				background-color: #8bff6185;
			}
			.piece {
				position: absolute;
				z-index: 1;
			}
			.move {
				position: absolute;
				background: radial-gradient(rgba(0, 255, 0, 0.4) 55%, transparent 57%);
				cursor: pointer;
				z-index: 2;
			}
			.move:hover {
				background: radial-gradient(rgba(157, 255, 154, 0.76) 55%, transparent 57%);
			}
			.move:active {
				background: radial-gradient(rgba(108, 115, 108, 0.76) 55%, transparent 57%);
			}
			.highlight {
				position: absolute;
				border: 8px dashed #fffb009c;
				z-index: 3;
			}
		`
		this.shadowRoot.append(style);
		defineAndInject(this, this.shadowRoot);
		this.flushBoard();

		const theme = this.getAttribute("theme") ?? "0";
		this.setTheme(theme);

		window.addEventListener("resize", (_) => this.renderPieces());
	}

	/**
	 * @param {number|string} theme
	 */
	setTheme(theme) {
		switch (theme?.toString()) {
			case "1":
				this.style.setProperty("--white", "#f0d9b5");
				this.style.setProperty("--black", "#b58863");
				break;
			case "2":
				this.style.setProperty("--white", "#d3ea94");
				this.style.setProperty("--black", "#6db567");
				break;
			case "3":
				this.style.setProperty("--white", "linear-gradient(135deg, #fff 60%, #eee)");
				this.style.setProperty("--black", "linear-gradient(135deg, #aad3df 60%, #a8c3ee)");
				break;
			default:
				this.style.setProperty("--white", "#fff");
				this.style.setProperty("--black", "#000");
				break;
		}
	}

	isEmpty() {
		return this.#pieces.flat().every(piece => piece === null)
	}

	getTileSize() {
		// TODO: This could be implemented better
		const topLeft = this.#tileElements[0][0]
		return topLeft?.offsetWidth ?? 0
	}

	/**
	 * @param {(Element|null)[][]} boardElements
	 */
	#clearBoardElements(boardElements) {
		for (let c = 0; c < this.#columns; c++) {
			for (let r = 0; r < this.#rows; r++) {
				boardElements[c][r]?.remove();
				boardElements[c][r] = null;
			}
		}
	}

	/**
	 * @param {number} column
	 * @param {number} row
	 */
	addHighlight(column, row) {
		if (!this.board) {
			throw new Error("Board was null");
		}

		if (this.#highlightElements[column][row]) {
			return
		}
		const highlightEl = document.createElement("div")
		highlightEl.classList.add("highlight")
		this.#highlightElements[column][row] = highlightEl
		this.setElementPosition(highlightEl, column, row)
		this.board.appendChild(highlightEl)
	}

	clearHighlights() {
		this.#clearBoardElements(this.#highlightElements)
	}

	/**
	 * @param {number} column
	 * @param {number} row
	 */
	addMoveIndicator(column, row) {
		if (!this.board) {
			throw new Error("Board was null");
		}

		if (this.#moveElements[column][row]) {
			return
		}
		const moveEl = document.createElement("div")
		moveEl.classList.add("move")
		moveEl.addEventListener("click", (event) => {
			if (this.onmoveclick) {
				this.onmoveclick(event, column, row, moveEl)
			}
		})
		this.#moveElements[column][row] = moveEl
		this.setElementPosition(moveEl, column, row)
		this.board.appendChild(moveEl)
		return moveEl
	}

	clearMoveIndicators() {
		this.#clearBoardElements(this.#moveElements)
	}

	/**
	 * @param {number} column
	 * @param {number} row
	 * @param {PieceData} pieceData
	 */
	setPiece(column, row, pieceData) {
		if (!this.board) {
			throw new Error("Board was null");
		}

		const pieceEl = createPieceSvgElement(pieceData.type, pieceData.colour)
		if (pieceEl == null) {
			throw new Error("Failed to create piece element");
		}
		pieceEl.classList.add("piece");
		pieceEl.dataset.column = String(column);
		pieceEl.dataset.row = String(row);

		pieceEl.addEventListener("click", (event) => {
			event.stopPropagation();
			const pieceColumn = +(pieceEl.dataset.column ?? 0);
			const pieceRow = +(pieceEl.dataset.row ?? 0);
			this.selected = { column: pieceColumn, row: pieceRow }

			if (localStorage.soundEnabled === "true") {
				this.#selectAudio.play()
			}
			if (this.onpiececlick) {
				this.onpiececlick(event, pieceColumn, pieceRow, pieceEl)
			}
		})

		this.#pieceElements[column][row] = pieceEl
		this.#pieces[column][row] = pieceData
		this.setElementPosition(pieceEl, column, row)
		this.board.appendChild(pieceEl)

		const pieceRotation = this.getSideRotation(this.#playingSide)
		pieceEl.animate({ transform: `rotate(${pieceRotation}deg)` },
			{ duration: 30, fill: "forwards" })
	}

	/**
	*
	* @param {number} column
	* @param {number} row
	* @param {number} toColumn
	* @param {number} toRow
	*/
	movePiece(column, row, toColumn, toRow) {
		if (!this.#pieceElements[column][row]) {
			throw new Error(`No piece found at (${column}, ${row})`);
		}

		this.#pieces[toColumn][toRow] = this.#pieces[column][row];
		this.#pieces[column][row] = null;
		const pieceElement = this.#pieceElements[toColumn][toRow] = this.#pieceElements[column][row];
		this.#pieceElements[column][row] = null;
		pieceElement.dataset.column = String(toColumn);
		pieceElement.dataset.row = String(toRow);

		this.setElementPosition(pieceElement, toColumn, toRow);
	}

	/**
	* @param {number} column
	* @param {number} row
	*/
	clearPiece(column, row) {
		this.#pieceElements[column][row]?.remove();
		this.#pieceElements[column][row] = null;
		this.#pieces[column][row] = null;
		if (localStorage.soundEnabled === "true") {
			this.#deleteAudio.play();
		}
	}

	/**
	* @param {HTMLElement|SVGElement} pieceEl
	* @param {number} column
	* @param {number} row
	*/
	setElementPosition(pieceEl, column, row) {
		const tileSize = this.getTileSize();
		pieceEl.style.left = (tileSize * column) + "px";
		pieceEl.style.top = (tileSize * row) + "px";
		pieceEl.style.width = tileSize + "px";
		pieceEl.style.height = tileSize + "px";
	}

	renderPieces() {
		for (let c = 0; c < this.#columns; c++) {
			for (let r = 0; r < this.#rows; r++) {
				const moveEl = this.#moveElements[c][r]
				if (moveEl) {
					this.setElementPosition(moveEl, c, r)
				}
				const pieceEl = this.#pieceElements[c][r]
				if (pieceEl) {
					this.setElementPosition(pieceEl, c, r)
				}
			}
		}
		this.rotateBoard(this.#playingSide)
	}

	resetAll() {
		this.#tileElements = new Array(this.#columns)
		this.#moveElements = new Array(this.#columns)
		this.#highlightElements = new Array(this.#columns)
		this.#pieceElements = new Array(this.#columns)
		this.#pieces = new Array(this.#columns)
		for (let c = 0; c < this.#columns; c++) {
			this.#tileElements[c] = new Array(this.#rows).fill(null)
			this.#moveElements[c] = new Array(this.#rows).fill(null)
			this.#highlightElements[c] = new Array(this.#rows).fill(null)
			this.#pieceElements[c] = new Array(this.#rows).fill(null)
			this.#pieces[c] = new Array(this.#rows).fill(null)
		}
	}

	/**
	 * @param {string} playingSide
	 */
	getSideRotation(playingSide) {
		switch (playingSide) {
			case "top":
			case "black":
				return -180;
			case "left":
				return 90;
			case "right":
				return -90;
			case "bottom":
			case "white":
				return 0;
		}
	}

	/**
	 * @param {string} playingSide
	 */
	rotateBoard(playingSide) {
		if (!this.board) {
			return;
		}

		this.#playingSide = playingSide
		const boardRotation = this.getSideRotation(playingSide)

		this.board.animate({ transform: `rotate(${boardRotation}deg)` },
			{ duration: 200, fill: "forwards" })
		for (const column of this.#pieceElements) {
			for (const piece of column) {
				if (piece) {
					piece.animate({ transform: `rotate(${boardRotation}deg)` },
						{ duration: 200, fill: "forwards" })
				}
			}
		}
	}

	flushBoard() {
		if (!this.board) {
			return;
		}

		this.board.innerHTML = "";
		this.board.style.setProperty("--columns", String(this.#columns));
		this.board.style.setProperty("--rows", String(this.#rows));
		this.board.style.gridTemplateRows = "none";
		this.#tileElements = [];
		for (let c = 0; c < this.#columns; c++) {
			this.#tileElements[c] = Array(this.#rows).fill(null);
		}

		let shift = this.turn == 1 ? 0 : 1
		for (let i = 0; i < this.#columns * this.#rows; i++) {
			const column = i % this.#columns
			const row = Math.floor(i / this.#columns)

			const tileEl = document.createElement("div")
			tileEl.classList.add("tile")
			this.#tileElements[column][row] = tileEl

			// Capture from component scope, otherwise this will be element scope
			tileEl.addEventListener("dragover", (event) => {
				event.preventDefault()
				if (typeof this.ontilehover === "function") {
					this.ontilehover(event, column, row, tileEl)
				}
			})
			tileEl.addEventListener("drop", (event) => {
				if (typeof this.ontiledrop === "function") {
					this.ontiledrop(event, column, row, tileEl)
				}
			})
			tileEl.addEventListener("dragleave", (event) => {
				if (typeof this.ontileleave === "function") {
					this.ontileleave(event, column, row, tileEl)
				}
			})
			tileEl.addEventListener("click", () => {
				this.clearMoveIndicators()
			})

			if ((column + shift) % 2 == 0) {
				tileEl.classList.add("tile-black")
			}
			else {
				tileEl.classList.add("tile-white")
			}
			if (column === this.#columns - 1) {
				shift = shift === 0 ? 1 : 0;
			}

			this.board.appendChild(tileEl)
		}
		this.sizeChanged = false
	}
}
customElements.define("ac-board", Board);
