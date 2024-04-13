class ListMatch extends HTMLElement {
    constructor() {
        super()
        this.attachShadow({ mode: "open" })
    }

    static get observedAttributes() {
        return [ "playerCount" ]
    }
    
    attributeChangedCallback(name, oldValue, newValue) {
        if (name === "playerCount") {
            this.playerCount.textContent = newValue
            if  (this.playerCount == this.getAttribute("capacity")) {
                this.playerCount.color = "red"
            }
        }
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = html`
            <div class="name-container">
                <span class="name" id="name">Unknown</span>
                <sub class="match-id">(Match ID: <span id="matchId">0</span>)</sub>
            </div>
            <div class="match-details" style="flex-grow: 3;">
                <p>Arrangement: <span id="arrangementId">0</span></p>
                <p>Ruleset: <span id="rulesetId">0</span></p>
                <p>Creator: <button id="creatorButton">View profile</button></p>
                <p>Players: <span id="playerCount" style="color: green;"></span>/<span id="capacity"></span></p>
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
                flex-grow: 1;
                max-width: 256px;
                column-gap: 4px;
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
            .play-button {
                display: flex;
                align-items: center;
            }
        `
        this.shadowRoot.append(style)
        this.tabIndex = "0"
        defineAndInject(this, this.shadowRoot)

        const _this = this
        this.creatorButton.onclick = async function() {
            const creatorId = _this.getAttribute("creatorId")
            const profileView = document.createElement("ac-profile-view")
            profileView.style.left = "50%"
            profileView.style.top = "50%"
            profileView.style.transform = "translateY(-50%)"
            _this.shadowRoot.appendChild(profileView)
            await profileView.loadFromUserId(+creatorId)
        }
        this.playButton.onclick = function() {
            const matchId = +_this.getAttribute("matchId")
            play(+matchId)
        }
        this.name.textContent = this.name.title = this.getAttribute("name")
        this.matchId.textContent = this.getAttribute("matchId")
        this.arrangementId.textContent = this.getAttribute("arrangementId")
        this.rulesetId.textContent = this.getAttribute("rulesetId")
        this.playerCount.textContent = this.getAttribute("playerCount")
        this.capacity.textContent = this.getAttribute("capacity")
    }
}

customElements.define("ac-list-match", ListMatch);

