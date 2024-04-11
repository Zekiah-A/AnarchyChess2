class Board extends HTMLElement {
    #tiles
    #tileElements
    #pieces
    #pieceElements
    #columns
    #playingSide
    #moveElements
    #rows
    #selectAudio
    #deleteAudio

    constructor() {
        super()
        this.turn = 0
        this.#rows = parseInt(this.getAttribute("rows")) || 8
        this.#columns = parseInt(this.getAttribute("columns")) || 8
        this.#playingSide = "white"
        this.#selectAudio = new Audio("resources/select-pop.mp3")
        this.#deleteAudio = new Audio("resources/delete-break.mp3")
        this.selected = null // { row: , column: }
        this.resetAll()

        this.ontilehover = null
        this.ontiledrop = null
        this.ontileleave = null
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

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === "rows" || name === "columns") {
            if (this.board == null) return

            const value = parseInt(newValue)
            if (value === NaN) return
            this[name] = value
            this.flushBoard()
        }
        if (name === "theme") {
            this.setTheme(newValue)
        }
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = html`
            <div id="board" class="board-container"></div>
        `
        const style = document.createElement("style")
        style.innerHTML = css`
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
            .hilight {
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
        `
        this.shadowRoot.append(style)
        defineAndInject(this, this.shadowRoot)
        this.flushBoard()

        const theme = this.getAttribute("theme")
        this.setTheme(theme)

        const _this = this
        window.addEventListener("resize", () => { _this.renderPieces() })
    }

    setTheme(theme) {
        switch (theme?.toString()) {
            case null:
            case undefined:
            case "0":
                this.style.setProperty("--white", "#fff")
                this.style.setProperty("--black", "#000")
                break
            case "1":
                this.style.setProperty("--white", "#f0d9b5")
                this.style.setProperty("--black", "#b58863")
                break
            case "2":
                this.style.setProperty("--white", "#d3ea94")
                this.style.setProperty("--black", "#6db567")
                break
            case "3":
                this.style.setProperty("--white", "linear-gradient(135deg, #fff 60%, #eee)")
                this.style.setProperty("--black", "linear-gradient(135deg, #aad3df 60%, #a8c3ee)")
                break
        }
    }

    getTileSize() {
        const topLeft = this.#tileElements[0][0]
        return topLeft.offsetWidth
    }

    clearMoveIndicators() {
        for (let c = 0; c < this.#columns; c++) {
            for (let r = 0; r < this.#rows; r++) {
                this.#moveElements[c][r]?.remove()
            }
            this.moveElements[c].length = 0
        }
    }

    addMoveIndicator(column, row) {
        if (this.#moveElements[column][row]) {
            return
        }
        const moveEl = document.createElement("div")
        moveEl.classList.add("move")
        const _this = this
        moveEl.addEventListener("click", function(event) {
            if (_this.onmoveclick) {
                _this.onmoveclick(event, column, row, moveEl)
            }
        })
        this.#moveElements[column][row] = moveEl
        this.setElementPosition(moveEl, column, row)
        this.board.appendChild(moveEl)
        return moveEl
    }

    setPiece(column, row, pieceData) {
        const pieceEl = createPieceSvgElement(pieceData.type, pieceData.colour)
        pieceEl.classList.add("piece")
        pieceEl.dataset.column = column
        pieceEl.dataset.row = row

        const _this = this
        pieceEl.addEventListener("click", function(event) {
            event.stopPropagation()
            const pieceColumn = +pieceEl.dataset.column
            const pieceRow = +pieceEl.dataset.row
            _this.selected = { column: pieceColumn, row: pieceRow }

            if (localStorage.soundEnabled === "true") {
                _this.#selectAudio.play()
            }
            if (_this.onpiececlick) {
                _this.onpiececlick(event, pieceColumn, pieceRow, pieceEl)
            }
        })

        this.#pieceElements[column][row] = pieceEl
        this.#pieces[column][row] = pieceData
        this.setElementPosition(pieceEl, column, row)
        this.board.appendChild(pieceEl)

        const pieceRotation = this.getSideRotation(this.#playingSide)
        pieceEl.animate({ transform: `rotate(${pieceRotation}deg)`},
            { duration: 30, fill: "forwards" })
    }

    movePiece(column, row, toColumn, toRow) {
        this.#pieces[toColumn][toRow] = this.#pieces[column][row]
        this.#pieces[column][row] = null
        const pieceElement = this.#pieceElements[toColumn][toRow] = this.#pieceElements[column][row]
        this.#pieceElements[column][row] = null
        pieceElement.dataset.column = toColumn
        pieceElement.dataset.row = toRow

        this.setElementPosition(pieceElement, toColumn, toRow)
    }

    clearPiece(column, row) {
        this.#pieceElements[column][row].remove()
        this.#pieceElements[column][row] = null
        this.#pieces[column][row] = null
        if (localStorage.soundEnabled === "true") {
            this.#deleteAudio.play()
        }
    }

    setElementPosition(el, column, row) {
        const tileSize = this.getTileSize()
        el.style.left = (tileSize * column) + "px"
        el.style.top = (tileSize * row) + "px"
        el.style.width = tileSize + "px"
        el.style.height = tileSize + "px"
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
        this.#pieceElements = new Array(this.#columns)
        this.#pieces = new Array(this.#columns)
        for (let c = 0; c < this.#columns; c++) {
            this.#tileElements[c] = new Array(this.#rows)
            this.#moveElements[c] = new Array(this.#rows)
            this.#pieceElements[c] = new Array(this.#rows)
            this.#pieces[c] = new Array(this.#rows)
        }
    }

    getSideRotation(playingSide) {
        switch (playingSide) {
            case "black":
                return -180
            case "left":
                return 90
            case "right":
                return -90
            default:
                return 0
        }
    }

    rotateBoard(playingSide) {
        this.#playingSide = playingSide
        const boardRotation = this.getSideRotation(playingSide)

        this.board.animate({ transform: `rotate(${boardRotation}deg)`},
            { duration: 200, fill: "forwards" })
        for (const column of this.#pieceElements) {
            for (const piece of column) {
                if (piece) {
                    piece.animate({ transform: `rotate(${boardRotation}deg)`},
                        { duration: 200, fill: "forwards" })
                }
            }
        }
    }

    flushBoard() {
        this.board.innerHTML = ""
        this.board.style.setProperty("--columns", this.#columns)
        this.board.style.setProperty("--rows", this.#rows)
        this.board.style.gridTemplateRows = "none"
        this.#tileElements = []
        for (let c = 0; c < this.#columns; c++) {
            this.#tileElements[c] = []
            for (let r = 0; r < this.#rows; r++) {
                this.#tileElements[c].push(null)
            }
        }

        let shift = this.turn == 1 ? 0 : 1
        for (let i = 0; i < this.#columns * this.#rows; i++) {
            const column = i % this.#columns
            const row = Math.floor(i / this.#columns)

            const tileEl = document.createElement("div")
            tileEl.classList.add("tile")
            this.#tileElements[column][row] = tileEl

            // Capture from component scope, otherwise this will be element scope
            const _this = this
            tileEl.addEventListener("dragover", function(event) {
                event.preventDefault()
                if (typeof _this.ontilehover === "function") {
                    _this.ontilehover(event, column, row, tileEl)
                }
            })
            tileEl.addEventListener("drop", function(event) {
                if (typeof _this.ontiledrop === "function") {
                        _this.ontiledrop(event, column, row, tileEl)
                }
            })
            tileEl.addEventListener("dragleave", function(event) {
                if (typeof _this.ontileleave === "function") {
                    _this.ontileleave(event, column, row, tileEl)
                }
            })
            tileEl.addEventListener("click", function() {
                _this.clearMoveIndicators()
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
