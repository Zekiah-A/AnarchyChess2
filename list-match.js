class ListMatch extends HTMLElement {
    constructor() {
        super()
        this.attachShadow({ mode: "open" })
    }

    static get observedAttributes() {
        return []
    }
    
    attributeChangedCallback(name, oldValue, newValue) {
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = html`
            <div class="name-container" style="flex-grow: 1;">
                <span class="name" id="name">Unknown</span>
                <sub class="match-id">(Match ID: <span id="matchId">0</span>)</sub>
            </div>
            <div class="match-details" style="flex-grow: 3;">
                <p>Arrangement: <span id="arrangementId">0</span></p>
                <p>Ruleset: <span id="rulesetId">0</span></p>
                <p>Creator: <button id="creatorButton">View profile</button></p>
                <p>Players: <span id="playerCount"></span>/<span id="capacity" class="capacity"></span></p>
            </div>
            <button class="play-button" id="playButton">
                <img src="./resources/play.svg" alt="Play">
                Join match
            </button>
        `
        const style = document.createElement("style")
        style.innerHTML = css`
            :host {
                border: 1px solid lightgray;
                border-radius: 8px;
                display: flex;
                padding: 4px;
                cursor: default;
                transition: .2s background-color;
            }
            :host(:hover), :host(:focus) {
                background-color: var(--ui-input);
            }
            .name-container {
                display: flex;
            }
            .name {
                max-width: 96px;
                display: inline-block;
                text-overflow: ellipsis;
                overflow: hidden;
                align-self: center;
            }
            .match-details {
                border-left: 1px dashed lightgray;
            }
            .match-details > p {
                margin: 8px;
            }
            .match-id {
                opacity: 0.6;
                font-size: 10px;        
                align-self: center;
            }
            .capacity {
                color: green;
            }
            .play-button {
                display: flex;
                align-items: center;
            }
        `
        this.shadowRoot.append(style)
        defineAndInject(this, this.shadowRoot)

        this.tabIndex = "0"
        this.name.textContent = this.name.title = this.getAttribute("name")
        this.matchId.textContent = this.getAttribute("matchId")
        this.arrangementId.textContent = this.getAttribute("arrangementId")
        this.rulesetId.textContent = this.getAttribute("rulesetId")
        const _this = this
        this.creatorButton.onclick = function() {
            let creatorId = _this.getAttribute("creatorId")
            console.log(creatorId)
        }
        this.playerCount.textContent = this.getAttribute("playerCount")
        this.capacity.textContent = this.getAttribute("capacity")
        this.playButton.onclick = function() {
            let matchId = +_this.getAttribute("matchId")
        }
    }
}

customElements.define("ac-list-match", ListMatch);

