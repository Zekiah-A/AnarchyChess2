import { LitElement, html, css } from "lit";
import { serverAddress, profileThemes } from "../resources.js";

export class ProfileView extends LitElement {
	static properties = {
		userId: { type: Number, attribute: "userid" },
		user: { state: true },
	};

	/**@type {boolean}*/#isDragging;
	/**@type {{x: number, y: number}}*/#dragOffset;

	constructor() {
		super();
		this.userId = 0;
		this.user = null;
		this.#isDragging = false;
		this.#dragOffset = { x: 0, y: 0 };
	}

	/**
	 * @param {Map<string, any>} changedProps
	 */
	updated(changedProps) {
		if (changedProps.has("userId") && this.userId != null) {
			this.loadFromUserId(this.userId);
		}
	}

	static styles = css`
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
			cursor: grab;
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
			pointer-events: none;
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
			border-radius: 100%;
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
	`;

	render() {
		const user = this.user;
		const loading = !user;
		const username = loading ? html`<img alt="loading..." height="32" src="resources/loading-icon.gif" />` : user.username;
		const profileImage = user?.profileImageUri ? `${serverAddress}/${user.profileImageUri}` : "./resources/logo.png";
		const stats = [
			["Games played", user?.gamesPlayed],
			["Matches won", user?.matchesWon],
			["Play time", user?.playTime],
		];

		return html`
			<div
				id="header"
				class="profile-header"
				@click=${this.#onHeaderClick}
				@mousedown=${this.#startDrag}
				@mousemove=${this.#onDrag}
				@mouseup=${this.#endDrag}
				@mouseleave=${this.#endDrag}
			>
				<button class="close-button" @click=${() => this.remove()}>
					<img src="./resources/close-icon.svg" alt="Close" />
				</button>
				<h2 class="profile-username">${username}</h2>
				<img class="profile-picture" src=${profileImage} draggable="false" />
			</div>
			<div class="profile-body">
				<fieldset class="profile-bio-section">
					<legend>About me</legend>
					<p>${user?.biography || "This user has no biography..."}</p>
					<div><span class="profile-stat">Location</span><span>${user?.location || "Unknown"}</span></div>
					<div><span class="profile-stat">Gender</span><span>${this.#getGenderName(user?.gender)}</span></div>
				</fieldset>
				<fieldset>
					<legend>My stats</legend>
					${stats.map(([label, value]) => html`
						<p>${label}: <span>${value ?? html`<img alt="loading..." width="16" src="resources/loading-icon.gif" />`}</span></p>
					`)}
				</fieldset>
			</div>
		`;
	}

	/**
	 * @param {string} gender
	 */
	#getGenderName(gender) {
		return {
			male: "Male",
			female: "Female",
			other: "Other",
		}[gender] || "Unknown";
	}

	/**
	 * @param {number} id
	 */
	async loadFromUserId(id) {
		const res = await fetch(`${serverAddress}/Profiles/${id}`);
		if (!res.ok) {
			const message = (await res.json())?.message;
			this.user = {
				biography: `Failed to load profile: ${message || "network error"}`,
			};
			return;
		}
		const data = await res.json();
		this.user = data;
		const theme = profileThemes[data.profileBackground || "none"];
		const header = this.shadowRoot?.getElementById("header");
		if (header) {
			header.style.setProperty("--profile-header-cover", theme.cover);
			header.style.background = theme.background;
		}
	}

	/**
	 * @param {MouseEvent} e
	 */
	#startDrag(e) {
		this.#isDragging = true;
		this.#dragOffset = { x: e.clientX - this.offsetLeft, y: e.clientY - this.offsetTop };
		this.style.cursor = "grabbing";
	}

	/**
	 * @param {MouseEvent} e
	 */
	#onDrag(e) {
		if (!this.#isDragging) return;
		this.style.left = `${Math.max(0, e.clientX - this.#dragOffset.x)}px`;
		this.style.top = `${Math.max(0, e.clientY - this.#dragOffset.y)}px`;
	}

	#endDrag() {
		this.#isDragging = false;
		this.style.cursor = "default";
	}

	/**
	 * @param {MouseEvent} e
	 */
	#onHeaderClick(e) {
		// Prevent text selection during drag
		e.preventDefault();
	}
}
customElements.define("ac-profile-view", ProfileView);
