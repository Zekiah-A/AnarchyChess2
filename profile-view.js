class ProfileView extends HTMLElement {
    constructor() {
        super()
        this.attachShadow({ mode: "open" })
    }

    static get observedAttributes() {
        return [ "userid" ]
    }
    
    attributeChangedCallback(name, oldValue, newValue) {
        if (name == "userid") this.loadFromUserId(+newValue)
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <div id="header" class="profile-header">
                <button class="close-button" id="closeButton">
                    <img src="./resources/close-icon.svg" alt="Close">
                </button>
                <h2 id="username" class="profile-username">
                    <img alt="loading..." draggable="false" height="32" src="resources/loading-icon.gif">
                </h2>
                <img id="picture" draggable="false" class="profile-picture" src="./resources/logo.png">
            </div>
            <div class="profile-body">
                <fieldset class="profile-bio-section">
                    <legend>About me</legend>
                    <p id="biography">This user has no biography...</p>
                    <div>
                        <span class="profile-stat">Location</span><span id="location">Unknown</span>
                    </div>
                    <div>
                        <span class="profile-stat">Gender</span><span id="gender">Unknown</span>
                    </div>
                </fieldset>
                <fieldset>
                    <legend>My stats</legend>
                    <p>
                        Games played:
                        <span id="gamesPlayed"><img alt="loading..." width="16" src="resources/loading-icon.gif"></span>
                    </p>
                    <p>
                        Matches won:
                        <span id="matchesWon"><img alt="loading..." width="16" src="resources/loading-icon.gif"></span>
                    </p>
                    <p>
                        Play time:
                        <span id="playTime"><img alt="loading..." width="16" src="resources/loading-icon.gif"></span>
                    </p>
                </fieldset>
            </div>
        `
        const style = document.createElement("style")
        style.innerHTML = `
            :host {
                position: fixed;
                background-color: lightgray;
                border-radius: 8px;
                z-index: 1;
                max-width: 360px;
                color: black;
            }

            .close-button {
                position: absolute;
                right: 0;
                top: 0;
                width: 42px;
                height: 42px;
            }

            .profile-header {
                border: 1px solid gray;
                padding-left: 96px;
                background: linear-gradient(-45deg, #a9ff86, transparent);
                border-radius: 8px 8px 0px 0px;
                padding-right: 96px;
                display: flex;
                flex-direction: column;
                height: 112px;
                max-height: 112px;
                position: relative;
            }

            .profile-header::before {
                content: "";
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: var(--profile-header-cover);
                background-size: 50px;
                opacity: 0.2;
            }

            .profile-username {
                opacity: 0.8;
                letter-spacing: 0.1em;
                text-align: center;
                flex-grow: 1;
                margin: 12px;
            }

            .profile-picture {
                align-self: center;
                width: 96px;
                height: 96px;
                min-height: 96px;
                min-width: 96px;
                border-radius: 100%;
                overflow: clip;
                position: relative;
                box-shadow: 0 2px 6px 0 #00000059;
                border: 1px solid gray;
                background-color: #fff;
                transition: 0.2s background-color;
            }

            .profile-body {
                background: white;
                border: 1px solid gray;
                border-top: none;
                padding: 4px;
            }

            .profile-bio-section {
                margin-top: 48px;
                display: flex;
                flex-direction: column;
                row-gap: 8px;
            }

            .profile-stat {
                background: var(--ui-input);
                padding: 2px;
                width: 92px;
                display: inline-block;
                border-radius: 32px;
                border: 1px solid #d3d3d3;
                margin-right: 8px;
                text-align: center;
            }
        `
        this.shadowRoot.append(style)
        defineAndInject(this, this.shadowRoot)
        let id = this.getAttribute("userid")
        if (id) this.loadFromUserId(+id)
        const _this = this
        this.closeButton.onclick = function() {
            _this.remove()
        }
        this.dragging = false
        this.header.onmousedown = function(event) {
            _this.dataset.dragging = "true"
            _this.header.style.cursor = "grabbing"
        }
        this.header.onmousemove = function(event) {
            if (_this.dataset.dragging !== "true") {
                return
            }
            _this.style.left = Math.max(0, _this.offsetLeft + event.movementX) + "px"
            _this.style.top = Math.max(0, _this.offsetTop + event.movementY) + "px"
        }
        function cancelDrag() {
            _this.dataset.dragging = "false"
            _this.header.style.cursor = "default"
        }
        this.header.onmouseup = cancelDrag
        this.header.onmouseleave = cancelDrag
    }

    getGenderFullName(name) {
        switch (name)
        {
            case "male":
                return "Male"
            case "female":
                return "Female"
            case "other":
                return "other"
            default:
                return "Unknown"
        }
    }

    loadFromData(user) {
        this.username.textContent = user.username
        if (user.profileImageUri) this.picture.src = `${serverAddress}/${user.profileImageUri}`
        if (user.biography) this.biography.textContent = user.biography
        if (user.location) this.location.textContent = user.location
        if (user.gender) this.gender.textContent = this.getGenderFullName(user.gender)
        this.gamesPlayed.textContent = user.gamesPlayed
        this.matchesWon.textContent = user.matchesWon
        this.playTime.textContent = user.playTime

        const theme = profileThemes[user.profileBackground || "none"]
        this.header.style.background = theme.background
        this.header.style.setProperty("--profile-header-cover", theme.cover)
    }

    async loadFromUserId(id) {
        const res = await fetch(`${serverAddress}/Profiles/${id}`, {
            method: "GET",
            headers: { "Content-Type": "application/json", },
        })
        if (!res.ok) {
            const message = (await res.json())?.message
            this.biography.textContent = `Failed to load profile: ${message || "network error"}`
            return
        }
        const user = await res.json()
        this.loadFromData(user)
    }
}

customElements.define("ac-profile-view", ProfileView);
