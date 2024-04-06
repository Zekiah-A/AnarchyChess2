class Board extends HTMLElement {
    #tiles
    #tileElements
    #pieces
    #pieceElements
    #columns
    #rows

    constructor() {
        super()
        this.turn = 0
        this.#rows = parseInt(this.getAttribute("rows")) || 8
        this.#columns = parseInt(this.getAttribute("columns")) || 8
        this.resetAll()

        this.ontilehover = null
        this.ontiledrop = null
        this.ontileleave = null
        this.attachShadow({ mode: "open" })
    }

    get tiles() {
        return this.#tiles
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

    setPiece(column, row, pieceData) {
        this.#tiles[column][row] = pieceData

        const pieceEl = createPieceSvgElement(pieceData.type)
        pieceEl.classList.add("piece")
        pieceEl.style.setProperty("--piece-fill", pieceData.colour)
        pieceEl.style.setProperty("--piece-stroke", pieceData.colour == "black" ? "white" : "black")

        const _this = this
        pieceEl.addEventListener("click", function (event) {
            if (_this.onpiececlick)
                _this.onpiececlick(event, column, row, pieceEl)
        })

        this.#pieceElements[column][row] = pieceEl
        this.#pieces[column][row] = pieceData
        this.setPiecePosition(pieceEl, column, row)
        this.board.appendChild(pieceEl)
    }

    clearPiece(column, row) {
        this.#tiles[column][row] = null
        this.#pieceElements[column][row].remove()
        this.#pieces[column].splice(row, 1)
    }

    setPiecePosition(pieceEl, column, row) {
        const tileSize = this.getTileSize()
        pieceEl.style.left = (tileSize * column) + "px"
        pieceEl.style.top = (tileSize * row) + "px"
        pieceEl.style.width = tileSize + "px"
        pieceEl.style.height = tileSize + "px"
    }

    renderPieces() {
        for (let c = 0; c < this.#columns; c++) {
            for (let r = 0; r < this.#rows; r++) {
                const pieceEl = this.#pieceElements[c][r]
                if (!pieceEl) continue
                this.setPiecePosition(pieceEl, c, r)
            }
        }
    }

    resetAll() {
        this.#tiles = new Array(this.#columns)
        this.#tileElements = new Array(this.#columns)
        this.#pieceElements = new Array(this.#columns)
        this.#pieces = new Array(this.#columns)
        for (let c = 0; c < this.#columns; c++) {
            this.#tiles[c] = new Array(this.#rows)
            this.#tileElements[c] = new Array(this.#rows)
            this.#pieceElements[c] = new Array(this.#rows)
            this.#pieces[c] = new Array(this.#rows)
        }
    }

    rotateBoard(playingSide) {
        let boardRotation = 0
        switch (playingSide) {
            case "black":
                boardRotation = 180
                break
            case "left":
                boardRotation = -90
                break
            case "right":
                boardRotation = 90
        }
        this.board.animate({ transform: `rotate(${boardRotation}deg)`},
            { duration: 200, fill: "forwards" })
        for (const column of this.#pieceElements) {
            for (const piece of column) {
                if (piece) {
                    piece.animate({ transform: `rotate(${-boardRotation}deg)`},
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
            tileEl.addEventListener("dragover", function (event) {
                event.preventDefault()
                if (typeof _this.ontilehover === "function")
                    _this.ontilehover(event, column, row, tileEl)
            })
            tileEl.addEventListener("drop", function (event) {
                if (typeof _this.ontiledrop === "function")
                    _this.ontiledrop(event, column, row, tileEl)
            })
            tileEl.addEventListener("dragleave", function (event) {
                if (typeof _this.ontileleave === "function")
                    _this.ontileleave(event, column, row, tileEl)
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
