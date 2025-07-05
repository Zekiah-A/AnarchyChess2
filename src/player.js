"use strict";

export class Player {
	/**
	 * @param {number} turnNumber
	 * @param {number} accountId
	 * @param {string} colour
	 */
	constructor(turnNumber, accountId, colour) {
		this.turnNumber = turnNumber;
		this.accountId = accountId;
		this.colour = colour;
		this.profile = null;
	}
}

