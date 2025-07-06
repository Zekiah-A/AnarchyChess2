import { LitElement, html, css } from "lit";

export class RulesetRule extends LitElement {
	static properties = {
		data: { type: Object },
	};

	constructor() {
		super();
		/**@type {{ condition: string, action: any }}*/
		this.data = { condition: "matchStart", action: {} };
	}

	static styles = css`
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
	`;

	/**
	 * Renders the template.
	 * @returns {import("lit").TemplateResult}
	 */
	render() {
		return html`
			<button class="delete-button" title="Delete rule" @click=${() => this.remove()}>
				<img src="./resources/close-icon.svg" alt="Delete rule" />
			</button>
			<div>
				<label for="type">Rule type:</label>
				<select id="type" disabled>
					<option value="event" selected>Game event</option>
				</select>
			</div>
			<div>
				<span style="font-weight: 700;">WHEN</span>
				<select id="condition" @change=${this.#onConditionChange}>
					<option value="matchStart">Match start</option>
					<option value="pieceKilled">Piece killed</option>
					<option value="pawnPromoted">Pawn promoted</option>
					<option value="blackInCheck">Black in check</option>
					<option value="whiteInCheck">White in check</option>
				</select>
			</div>
			<div>
				<select id="action" @change=${this.#onActionChange}>
					<option value="spawn">Spawn</option>
					<option value="delete">Delete</option>
					<option value="setCurrentTurn">Set current turn to</option>
				</select>
				${this.#renderActionForm()}
			</div>
		`;
	}

	/**
	 * Handles the change event for the condition select.
	 * @param {Event} e 
	 */
	#onConditionChange(e) {
		const select = /** @type {HTMLSelectElement} */ (e.target);
		this.data = {
			...this.data,
			condition: select.value,
		};
	}

	/**
	 * Handles the change event for the action select.
	 * @param {Event} e 
	 */
	#onActionChange(e) {
		const select = /** @type {HTMLSelectElement} */ (e.target);
		const type = select.value;

		switch (type) {
			case "spawn":
				this.data = {
					...this.data,
					action: { type: "spawn", atPosition: "A1", atType: "pawn", atColour: "black" },
				};
				break;
			case "delete":
				this.data = {
					...this.data,
					action: { type: "delete", atPosition: "A1" },
				};
				break;
			case "setCurrentTurn":
				this.data = {
					...this.data,
					action: { type: "setCurrentTurn", turnColour: "next" },
				};
				break;
		}
	}

	/**
	 * Renders the second half of the action UI based on current action type.
	 * @returns {import("lit").TemplateResult}
	 */
	#renderActionForm() {
		const { action } = this.data;
		if (!action || !action.type) {
			return html``;
		}

		switch (action.type) {
			case "spawn":
				return html`
					<select @change=${(/**@type {Event}*/e) => this.#updateField("atColour", e)}>
						<option value="black" ?selected=${action.atColour === "black"}>Black</option>
						<option value="white" ?selected=${action.atColour === "white"}>White</option>
					</select>
					<select @change=${(/**@type {Event}*/e) => this.#updateField("atType", e)}>
						<option value="pawn" ?selected=${action.atType === "pawn"}>Pawn</option>
						<option value="rook" ?selected=${action.atType === "rook"}>Rook</option>
						<option value="knight" ?selected=${action.atType === "knight"}>Knight</option>
						<option value="bishop" ?selected=${action.atType === "bishop"}>Bishop</option>
						<option value="queen" ?selected=${action.atType === "queen"}>Queen</option>
						<option value="king" ?selected=${action.atType === "king"}>King</option>
					</select>
					at
					<input type="text" maxlength="2" placeholder="A1" .value=${action.atPosition}
						@input=${(/**@type {Event}*/e) => this.#updateField("atPosition", e)} style="width: 48px;" />
				`;
			case "delete":
				return html`
					at
					<input type="text" maxlength="2" placeholder="A1" .value=${action.atPosition}
						@input=${(/**@type {Event}*/e) => this.#updateField("atPosition", e)} style="width: 48px;" />
				`;
			case "setCurrentTurn":
				return html`
					<select @change=${(/**@type {Event}*/e) => this.#updateField("turnColour", e)}>
						<option value="next" ?selected=${action.turnColour === "next"}>Next player</option>
						<option value="previous" ?selected=${action.turnColour === "previous"}>Previous player</option>
						<option value="random" ?selected=${action.turnColour === "random"}>Random</option>
						<option value="current" ?selected=${action.turnColour === "current"}>Current player</option>
					</select>
				`;
			default:
				return html``;
		}
	}

	/**
	 * Updates a field on the action object and triggers reactivity.
	 * @param {string} field
	 * @param {Event} e
	 */
	#updateField(field, e) {
		const input = /** @type {HTMLInputElement|HTMLSelectElement} */ (e.target);
		this.data = {
			...this.data,
			action: {
				...this.data.action,
				[field]: input.value,
			},
		};
	}
}
customElements.define("ac-ruleset-rule", RulesetRule);
