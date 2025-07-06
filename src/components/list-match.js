import { LitElement, html, css } from "lit";
import {ProfileView} from "./profile-view.js";

export class ListMatch extends LitElement {
	static properties = {
		name: { type: String },
		matchId: { type: Number },
		arrangementId: { type: Number },
		rulesetId: { type: Number },
		creatorId: { type: Number },
		playerCount: { type: Number },
		capacity: { type: Number },
	};

	/**@type {((e: Event) => void)|null}*/ onplayclicked;

	constructor() {
		super();
		this.name = "Unknown";
		this.matchId = 0;
		this.arrangementId = 0;
		this.rulesetId = 0;
		this.creatorId = 0;
		this.playerCount = 0;
		this.capacity = 0;
		this.onplayclicked = null;
	}

	static styles = css`
		:host {
			border: 1px solid lightgray;
			display: flex;
			padding: 4px;
			cursor: default;
			transition: 0.2s background-color;
		}
		:host(:hover),
		:host(:focus) {
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
			flex-grow: 3;
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
	`;

	render() {
		const playerCountColour = this.playerCount === this.capacity ? "red" : "green";

		return html`
			<div class="name-container">
				<span class="name" id="name" title=${this.name}>${this.name}</span>
				<sub class="match-id">(Match ID: <span id="matchId">${this.matchId}</span>)</sub>
			</div>
			<div class="match-details">
				<p>Arrangement: <span id="arrangementId">${this.arrangementId}</span></p>
				<p>Ruleset: <span id="rulesetId">${this.rulesetId}</span></p>
				<p>
					Creator:
					<button id="creatorButton" @click=${this.#onCreatorClick}>View profile</button>
				</p>
				<p>
					Players:
					<span id="playerCount" style="color: ${playerCountColour};">${this.playerCount}</span>/<span id="capacity">${this.capacity}</span>
				</p>
			</div>
			<button class="play-button" id="playButton" @click=${this.#onPlayClick}>
				<img src="./resources/play.svg" alt="Play" />
				Join match
			</button>
		`;
	}

	/**
	 * @param {Event} e
	 */
	async #onCreatorClick(e) {
		if (!this.creatorId) {
			return;
		}
		const profileView = /**@type {ProfileView}*/(document.createElement("ac-profile-view"));
		profileView.style.left = "50%";
		profileView.style.top = "50%";
		profileView.style.transform = "translateY(-50%)";
		this.shadowRoot?.appendChild(profileView);
		await profileView.loadFromUserId(+this.creatorId);
	}

	/**
	 * @param {MouseEvent} e
	 */
	#onPlayClick(e) {
		if (typeof this.onplayclicked === "function") {
			this.onplayclicked(e);
		}
	}
}
customElements.define("ac-list-match", ListMatch);
