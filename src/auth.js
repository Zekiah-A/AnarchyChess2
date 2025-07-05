"use strict";
import { serverAddress } from "./resources.js";

/**@type {number|null}*/export let myId = null;
/**@type {string|null}*/export let myToken = null; // TODO: Token should _NOT_ be present in the code :skull:
// Get login token
/**
 * @param {string} username
 * @param {string} email
 */
export async function login(username, email) {
	const res = await fetch(`${serverAddress}/Login`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ username, email }),
	});
	if (!res.ok) {
		const message = (await res.json())?.message;
		alert("Login failed - " + (message || "network error"));
		return false;
	}

	const data = await res.json();
	myToken = data.token;
	myId = data.id;
	// Used to indicate to client that we are currently logged in & likely have a cookie
	localStorage.me = myId;
	return true;
}

export async function loginToken() {
	const res = await fetch(`${serverAddress}/Login`, { method: "POST" });
	if (!res.ok) {
		const message = (await res.json())?.message;
		console.error("Automatic login failed - " + (message || "network error"));
		signout();
		return false;
	}

	const data = await res.json();
	myToken = data.token;
	myId = data.id;
	// localStorage.me is used to indicate if logged in after site reload
	localStorage.me = myId;
	return true;
}

/**
 * @param {string} username
 * @param {string} email
 */
export async function signup(username, email) {
	const res = await fetch(`${serverAddress}/Signup`, {
		method: "POST",
		headers: { "Content-Type": "application/json", },
		body: JSON.stringify({ username, email }),
	});
	if (!res.ok) {
		const message = (await res.json())?.message;
		alert("Signup failed - " + (message || "network error"));
		return false;
	}

	const data = await res.json();
	alert("Success - " + data.message);
	return true;
}

export function signout() {
	// Localstorage.me reminds the code that we are logged in on page reload, delete
	delete localStorage.me;
	location.reload();
}

/**
 * @param {string} relativeUri
 * @param {string} method
 * @param {Object} bodyObject
 * @param {string} failMsg
 */
export async function authedRequest(relativeUri, method, bodyObject, failMsg) {
	if (!myToken) {
		const message = "No authorisation";
		alert(failMsg + " - " + message);
		return false;
	}
	const res = await fetch(`${serverAddress}/${relativeUri}`, {
		method: "POST",
		headers: {
			Authorization: myToken,
			"Content-Type": "application/json"
		},
		body: JSON.stringify(bodyObject)
	});
	if (!res.ok) {
		const message = (await res.json())?.message;
		alert(failMsg + " - " + (message || "network error"));
		return false;
	}

	return true;
}


