class RulesetRule extends HTMLElement {
    constructor() {
        super()
        this.attachShadow({ mode: "open" })
        // Action types: SpawnPieceAt, DeletePieceAt, SetCurrentTurn
        this.data = { condition: "matchStart", action: {  } }
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <button class="delete-button" id="deleteButton" title="Delete rule">
                <img src="./resources/close-icon.svg" alt="Delete rule">
            </button>
            <div>
                <label for="type">Rule type:</label>
                <select id="type" value="event">
                    <option value="event">Game event</option>
                </select>
            </div>
            <div>
                <span style="font-weight: 700;" id="keyword">WHEN</span>
                <select id="condition">
                    <option value="matchStart">Match start</option>
                    <option value="pieceKilled">Piece killed</option>
                    <option value="pawnPromoted">Pawn promoted</option>
                    <option value="blackInCheck">Black in check</option>
                    <option value="whiteInCheck">White in check</option>
                <select>
                <select id="action">
                    <option value="spawn">Spawn</option>
                    <option value="delete">Delete</option>
                    <option value="setCurrentTurn">Set current turn to</option>
                <select>
                <span id="action1"><span>
            </div>
        `
        const style = document.createElement("style")
        style.innerHTML = `
            :host {
                min-height: 128px;
                position: relative;
                border: 1px solid lightgray;
                row-gap: 24px;
                display: flex;
                flex-direction: column;
                padding: 4px;
                cursor: default;
                transition: .2s background-color;
            }
            :host(:hover), :host(:focus) {
                background-color: var(--ui-input);
            }

            .delete-button {
                position: absolute;
                display: flex;
                align-items: center;
                top: 0;
                right: 0;
            }
        `
        this.shadowRoot.append(style)
        defineAndInject(this, this.shadowRoot)
        this.tabIndex = "0"
        this.updateCondition()
        this.updateAction1()
        
        const _this = this
        this.deleteButton.onclick = function() {
            _this.remove()
        }
        this.condition.onchange = () => _this.updateCondition()
        this.action.onchange = () => _this.updateAction1()
    }

    updateCondition() {
        this.data.condition = this.condition.value
    }

    updateAction1() {
        switch (this.action.value) {
            case "spawn": {
                this.action1.innerHTML = `
                    <select id="atColour">
                        <option value="black">Black</option>
                        <option value="white">White</option>
                    </select>
                    <select id="atType">
                        <option value="pawn">Pawn</option>
                        <option value="rook">Rook</option>
                        <option value="knight">Knight</option>
                        <option value="bishop">Bishop</option>
                        <option value="queen">Queen</option>
                        <option value="king">King</option>
                    </select>
                    at
                    <input id="atPosition" type="text" style="width: 48px;" maxlength="2" placeholder="A1" value="A1">
                `
                defineAndInject(this, this.shadowRoot)
                this.data.action = { type: "spawn", atPosition: "A1", atType: "pawn", atColour: "black" }
                this.atPosition.onchange = function() {
                    this.data.action.atPosition = this.atPosition.value 
                }
                this.atType.onchange = function() {
                    this.data.action.atType = this.atType.value 
                }
                this.atColour.onchange = function() {
                    this.data.action.atColour = this.atColour.value 
                }
                break
            }
            case "delete": {
                this.action1.innerHTML = `
                    at
                    <input id="atPosition" type="text" style="width: 48px;" maxlength="2" placeholder="A1" value="A1">
                `
                defineAndInject(this, this.shadowRoot)
                this.data.action = { type: "delete", atPosition: "A1" }
                this.atPosition.onchange = function() {
                    this.data.action.atPosition = this.atPosition.value
                }
                break
            }
            case "setCurrentTurn": {
                this.action1.innerHTML = `
                    <select id="turnColour">
                        <option value="next">Next player</option>
                        <option value="previous">Previous player</option>
                        <option value="random">Random</option>
                        <option vlaue="current">Current player</option>
                    </select>
                `
                defineAndInject(this, this.shadowRoot)
                this.data.action = { type: "setCurrentTurn", turnColour: "black" }
                this.turnColour.onchange = function() {
                    this.data.action.turnColour = this.turnColour.value
                }
                break
            }
        }
    }
}

customElements.define("ac-ruleset-rule", RulesetRule);
