"use strict";
import { PieceData } from "./piece-data.js";
import { Board } from "./components/board.js";
import { ProfileView } from "./components/profile-view.js";
import { createFromData } from "./components/component-registrar.js";
import { serverAddress, socketAddress, profileThemes } from "./resources.js";
import { play, animateDestroyPiece } from "./game.js";
import { myId, myToken, login, loginToken, signup, signout, authedRequest } from "./auth.js";
import { confetti } from "@tsparticles/confetti";

// Elements
const gameScreen = /**@type {HTMLElement}*/(document.getElementById("gameScreen"));
const mainMenu = /**@type {HTMLElement}*/(document.getElementById("mainMenu"));
const header = /**@type {HTMLElement}*/(document.getElementById("header"));
const headerContent = /**@type {HTMLElement}*/(document.getElementById("headerContent"));
const headerBranding = /**@type {HTMLElement}*/(document.getElementById("headerBranding"));
const headerNav = /**@type {HTMLElement}*/(document.getElementById("headerNav"));
const loginForm = /**@type {HTMLFormElement}*/(document.getElementById("loginForm"));
const loginUsername = /**@type {HTMLInputElement}*/(document.getElementById("loginUsername"));
const loginEmail = /**@type {HTMLInputElement}*/(document.getElementById("loginEmail"));
const loginButton = /**@type {HTMLButtonElement}*/(document.getElementById("loginButton"));
const signupUsername = /**@type {HTMLInputElement}*/(document.getElementById("signupUsername"));
const signupEmail = /**@type {HTMLInputElement}*/(document.getElementById("signupEmail"));
const signupConfirm = /**@type {HTMLInputElement}*/(document.getElementById("signupConfirm"));
const signupButton = /**@type {HTMLButtonElement}*/(document.getElementById("signupButton"));
const signupForm = /**@type {HTMLFormElement}*/(document.getElementById("signupForm"));
const configurePanel = /**@type {HTMLDialogElement}*/(document.getElementById("configurePanel"));
const arrangementTabButton = /**@type {HTMLElement}*/(document.getElementById(""));
const rulesetRules = /**@type {HTMLElement}*/(document.getElementById("rulesetRules"));
const arrangementBoard = /**@type {Board}*/(document.getElementById("arrangementBoard"));
const arrangementSideSection = /**@type {Board}*/(document.getElementById("arrangementSideSection"));
const arrangementColumns = /**@type {HTMLElement}*/(document.getElementById("arrangementColumns"));
const arrangementRows = /**@type {HTMLElement}*/(document.getElementById("arrangementRows"));
const arrangementCanvas = /**@type {HTMLCanvasElement}*/(document.getElementById("arrangementCanvas"));
const arrangementStats = /**@type {HTMLElement}*/(document.getElementById("arrangementStats"));
const matchPanel = /**@type {HTMLDialogElement}*/(document.getElementById("matchPanel"));
const matchList = /**@type {HTMLElement}*/(document.getElementById("matchList"));
const matchIdInput = /**@type {HTMLElement}*/(document.getElementById("matchIdInput"));
const createRuleset = /**@type {HTMLSelectElement}*/(document.getElementById("createRuleset"));
const createArrangement = /**@type {HTMLSelectElement}*/(document.getElementById("createArrangement"));
const createLobbyCapacity = /**@type {HTMLInputElement}*/(document.getElementById("createLobbyCapacity"));
const createLobbyName = /**@type {HTMLInputElement}*/(document.getElementById("createLobbyName"));
const createPublic = /**@type {HTMLInputElement}*/(document.getElementById("createPublic"));
const createRulesetButton = /**@type {HTMLElement}*/(document.getElementById("createRulesetButton"));
const createArrangementButton = /**@type {HTMLElement}*/(document.getElementById("createArrangementButton"));
const createJoinButton = /**@type {HTMLElement}*/(document.getElementById("createJoinButton"));
const joinLobbyButton = /**@type {HTMLElement}*/(document.getElementById("joinLobbyButton"));
const createMatchButton = /**@type {HTMLElement}*/(document.getElementById("createMatchButton"));
const mainMenuBoard = /**@type {Board}*/(document.getElementById("mainMenuBoard"));
const globalOnlineLabel = /**@type {HTMLElement}*/(document.getElementById("globalOnlineLabel"));
const globalActiveLabel = /**@type {HTMLElement}*/(document.getElementById("globalActiveLabel"));
const profileNeedsLogin = /**@type {HTMLElement}*/(document.getElementById("profileNeedsLogin"));
const profileContent = /**@type {HTMLElement}*/(document.getElementById("profileContent"));
const profileHeader = /**@type {HTMLElement}*/(document.getElementById("profileHeader"));
const profileUsername = /**@type {HTMLElement}*/(document.getElementById("profileUsername"));
const profilePicture = /**@type {HTMLImageElement}*/(document.getElementById("profilePicture"));
const profilePictureInput = /**@type {HTMLInputElement}*/(document.getElementById("profilePictureInput"));
const profileBiography = /**@type {HTMLElement}*/(document.getElementById("profileBiography"));
const profileLocation = /**@type {HTMLInputElement}*/(document.getElementById("profileLocation"));
const profileGender = /**@type {HTMLSelectElement}*/(document.getElementById("profileGender"));
const profileGamesPlayed = /**@type {HTMLElement}*/(document.getElementById("profileGamesPlayed"));
const profileMatchesWon = /**@type {HTMLElement}*/(document.getElementById("profileMatchesWon"));
const profilePlayTime = /**@type {HTMLElement}*/(document.getElementById("profilePlayTime"));
const settingsContent = /**@type {HTMLElement}*/(document.getElementById("settingsContent"));
const boardThemeSelect = /**@type {HTMLSelectElement}*/(document.getElementById("boardThemeSelect"));
const siteThemeSelect = /**@type {HTMLSelectElement}*/(document.getElementById("siteThemeSelect"));
const soundCheckbox = /**@type {HTMLInputElement}*/(document.getElementById("soundCheckbox"));
const effectsCheckbox = /**@type {HTMLInputElement}*/(document.getElementById("effectsCheckbox"));
const serverInput = /**@type {HTMLInputElement}*/(document.getElementById("serverInput"));
const settingsResetButton = /**@type {HTMLButtonElement}*/(document.getElementById("settingsResetButton"));
const accountSignoutButton = /**@type {HTMLButtonElement}*/(document.getElementById("accountSignoutButton"));
const accountDeleteButton = /**@type {HTMLButtonElement}*/(document.getElementById("accountDeleteButton"));

// Definitions
/**@type {number|null}*/let globalStatsInterval = null;
/**@type {number|null}*/let matchListInterval = null;

// Utils
/**
 * @param {KeyboardEvent} event 
 */
function maybeSelectNext(event) {
	if (event.key === "Enter" && event.target instanceof HTMLElement) {
		const nextInput = event.target?.nextElementSibling;
		if (nextInput instanceof HTMLInputElement) {
			nextInput?.focus();
		}
	}
}

/**
 * @param {Event} e
 */
function validateUsername(e) {
	const input = e.target;
	if (!(input instanceof HTMLInputElement)) {
		return;
	}
	input.value = input.value.replace(/\W+/g, "").toLowerCase();
}
/**
 * @param {number} from
 * @param {number} to
 * @param {number} weight
 */
function lerp(from, to, weight) {
	return (1 - weight) * from + weight * to;
}
/**
 * @param {HTMLSelectElement} select
 */
function appendDefaultOption(select) {
	const defaultOption = document.createElement("option");
	defaultOption.value = "0";
	defaultOption.textContent = "Default";
	select.appendChild(defaultOption);
}

// Navigation
function switchToGameScreen() {
	mainMenu.style.display = "none";
	gameScreen.style.display = "block";
	configurePanel.close;
	matchPanel.close();
	clearInterval(mainMenuBoardInterval);
	if (matchListInterval) {
		clearInterval(matchListInterval);
	}
	if (globalStatsInterval) {
		clearInterval(globalStatsInterval);
	}
}
/**
 * @param {string} pageName
 */
function setMainMenuPage(pageName) {
	const page = /**@type {HTMLElement}*/(mainMenu.querySelector(`.main-menu-page[data-page="${pageName}"]`));
	if (!page) {
		return;
	}

	// data-page="home"
	headerNav.querySelector(".page-link-current")?.classList.remove("page-link-current");
	headerNav.querySelector(`a[data-page=${pageName}]`)?.classList.add("page-link-current");

	mainMenu.querySelectorAll(".main-menu-page").forEach((pageEl) => {
		if (pageEl instanceof HTMLElement) {
			pageEl.style.display = "none";
		}
	});
	page.style.display = "flex";
}
function setHashPage(mainFallback = false) {
	const pages = ["home", "login", "signup", "profile", "settings"];
	const page = window.location.hash?.slice(1);
	if (pages.includes(page)) {
		setMainMenuPage(page);
	}
	else if (mainFallback) {
		setMainMenuPage("home");
	}
}
window.addEventListener("hashchange", () => setHashPage(false));
setHashPage(true);

// Header
header.addEventListener("wheel", function(e) {
	mainMenu.scrollBy({
		top: e.deltaY,
		left: 0,
		behavior: "smooth"
	});
});
/**@type {number|null}*/let scrollAnim = null;
function setHeaderWillChange() { // Optimisation
	headerBranding.style.willChange = "left, top, scale";
	headerNav.style.willChange = "left, top";
	headerContent.style.willChange = "height, box-shadow";
}
function clearHeaderWillChange() {
	headerBranding.style.willChange = "auto";
	headerNav.style.willChange = "auto";
	headerContent.style.willChange = "auto";
}
let headerPositionFrame = 0;
function calcHeaderPositioning() {
	setHeaderWillChange();
	headerPositionFrame = requestAnimationFrame(positionHeader);
	function positionHeader() {
		if (headerPositionFrame !== 0) {
			cancelAnimationFrame(headerPositionFrame);
			headerPositionFrame = 0;
		}
		const portrait = window.innerWidth < window.innerHeight;
		const toCollapsed = Math.min(1, mainMenu.scrollTop / 100);
		const headerCentreX = header.offsetWidth / 2;
		headerContent.style.boxShadow = `0px 0px ${Math.min(8, mainMenu.scrollTop)}px gray`;
		headerContent.style.height = `${Math.max(100, 200 - mainMenu.scrollTop)}px`;

		if (portrait) {
			headerBranding.style.left = `${headerCentreX - headerBranding.offsetWidth / 2}px`;
			headerBranding.style.top = `${lerp(0, -16, toCollapsed)}px`;
			headerBranding.style.scale = `${lerp(1, 0.6, toCollapsed)}`;

			headerNav.style.left = `${headerCentreX - headerNav.offsetWidth / 2}px`;
			headerNav.style.top = `${lerp(120, 60, toCollapsed)}px`;
		}
		else {
			headerBranding.style.top = "0px";
			headerBranding.style.left = `${lerp(headerCentreX - headerBranding.offsetWidth / 2, 16, toCollapsed)}px`;
			headerBranding.style.scale = `${lerp(1.2, 0.8, toCollapsed)}`;

			headerNav.style.left = `${lerp(headerCentreX - headerNav.offsetWidth / 2, header.offsetWidth - headerNav.offsetWidth - 16, toCollapsed)}px`;
			headerNav.style.top = `${lerp(120, 50 - headerNav.offsetHeight / 2, toCollapsed)}px`;
		}

		clearHeaderWillChange();
	}

	if (scrollAnim) {
		clearTimeout(scrollAnim);
		scrollAnim = null;
	}
	if (mainMenu.scrollTop < 100) {
		const toCollapsed = Math.min(1, mainMenu.scrollTop / 100);
		let scrollTarget = toCollapsed < 0.5 ? 0 : 100;
		setHeaderWillChange();
		scrollAnim = setTimeout(() => {
			mainMenu.scrollTo({
				top: scrollTarget,
				left: 0,
				behavior: "smooth",
			});
			setTimeout(clearHeaderWillChange, 500);
		}, 200);
	}
}
mainMenu.addEventListener("scroll", calcHeaderPositioning);
window.addEventListener("resize", calcHeaderPositioning);
calcHeaderPositioning();

// Login page
loginUsername.addEventListener("input", validateUsername);
loginUsername.addEventListener("keydown", maybeSelectNext);
loginEmail.addEventListener("keydown", maybeSelectNext);
loginForm.addEventListener("submit", async function(e) {
	e.preventDefault();

	if (loginUsername.value && loginEmail.value && loginEmail.validity.valid) {
		if (await login(loginUsername.value, loginEmail.value)) {
			applyLoginUi();
			setMainMenuPage("home");
		}
	}
});

// Signup page
signupUsername.addEventListener("input", validateUsername);
signupUsername.addEventListener("keydown", maybeSelectNext);
loginUsername.addEventListener("keydown", maybeSelectNext);
signupEmail.addEventListener("keydown", maybeSelectNext);
signupConfirm.addEventListener("input", function(e) {
	signupConfirm.setCustomValidity(signupEmail.value === signupConfirm.value ? "" : "Emails don't match!");
	signupConfirm.reportValidity();
});
signupConfirm.addEventListener("keydown", maybeSelectNext);
signupForm.addEventListener("submit", async function(e) {
	e.preventDefault();

	if (signupUsername.value && signupEmail.value && signupEmail.validity.valid) {
		if (await signup(signupUsername.value, signupEmail.value)) {
			if (await login(signupUsername.value, signupEmail.value)) {
				applyLoginUi();
				setMainMenuPage("home");
			}
			loginUsername.value = signupUsername.value;
			loginEmail.value = signupEmail.value;
		}
		signupUsername.value = "";
		signupEmail.value = "";
		signupConfirm.value = "";
	}
});

// Home page
// -  Random piece arrangement
/**@type {number|null}*/let putInterval = null
function randomMainMenuBoard() {
	if (putInterval !== null) {
		clearInterval(putInterval);
	}
	for (let c = 0; c < mainMenuBoard.columns; c++) {
		for (let r = 0; r < mainMenuBoard.rows; r++) {
			if (mainMenuBoard.pieceElements[c][r]) {
				animateDestroyPiece(mainMenuBoard, null, c, r);
			}
		}
	}
	setTimeout(() => {
		// Setting columns and rows will trigger flush, resulting in three flushes per change.
		// TODO: Optimise with something like a special resizeClear() method
		const columnsRows = 6 + Math.floor(Math.random() * 8);
		mainMenuBoard.columns = columnsRows;
		mainMenuBoard.rows = columnsRows;
		mainMenuBoard.resetAll();
		mainMenuBoard.flushBoard();

		let i = 0;
		const tileCount = columnsRows ** 2;
		putInterval = setInterval(() => {
			if (Math.random() > 0.8) {
				const type = ["pawn", "rook", "knight", "bishop", "queen", "king"][Math.floor(Math.random() * 6)];
				const piece = new PieceData(type, Math.random() > 0.5 ? "black" : "white");
				mainMenuBoard.setPiece(i % columnsRows, Math.floor(i / columnsRows), piece);
			}

			i++;
			if (i + 1 == tileCount && putInterval !== null) {
				clearInterval(putInterval);
			}
		}, (2e4 - 3000) / tileCount);
	}, 3000);
}
let mainMenuBoardInterval = setInterval(randomMainMenuBoard, 2e4);
randomMainMenuBoard();

// Arrangement
let arrangementPrevValid = false;
let arrangementCanvasConfetti = null;
/**@type {number|null}*/let arrangementCurCol = null;
/**@type {number|null}*/let arrangementCurType = null;
/**@type {number|null}*/let arrangementSelC = null;
/**@type {number|null}*/let arrangementSelR = null;
confetti.create(arrangementCanvas, { resize: true }).then(confetti => {
	arrangementCanvasConfetti = confetti;
})

arrangementBoard.ontilehover = function(e, column, row, tile) {
	tile.classList.add("highlight");
}
arrangementBoard.ontiledrop = function(e, column, row, tile) {
	if (arrangementCurCol === null || arrangementCurType == null) return
	tile.classList.remove("highlight");
	arrangementBoard.setPiece(column, row, new PieceData(arrangementCurType, arrangementCurCol));
	updateArrangementStats();
}
arrangementBoard.ontileleave = function(e, column, row, tile) {
	tile.classList.remove("highlight");
}
arrangementBoard.onpiececlick = function(e, column, row, piece) {
	if (arrangementSelC != null && arrangementSelR != null) {
		const previousSelected = arrangementBoard.pieceElements[arrangementSelC][arrangementSelR];
		previousSelected?.getAnimations().map(animation => animation.cancel());
	}
	arrangementSelC = column;
	arrangementSelR = row;

	piece.animate([{
		border: "8px solid var(--ui-highlight-transparent)",
		transform: "scale(1.1)",
	},
	], {
		fill: "forwards",
		duration: 200,
		iterations: 1,
	});
}
arrangementSideSection.addEventListener("dragstart", function(e) {
	const dragged = e.target;
	if (dragged.nodeName == "IMG") {
		arrangementCurCol = dragged.dataset.colour;
		arrangementCurType = dragged.dataset.type;
		dragged.style.border = "2px solid var(--ui-special)";
	}
});
arrangementSideSection.addEventListener("dragend", function(e) {
	const dragged = e.target;
	if (dragged.nodeName == "IMG") {
		dragged.style.removeProperty("border");
	}
});
function getArrangementStats() {
	let whiteKing = false;
	let blackKing = false;
	let blackCount = 0;
	let whiteCount = 0;

	for (let c = 0; c < arrangementBoard.columns; c++) {
		for (let r = 0; r < arrangementBoard.rows; r++) {
			const pieceData = arrangementBoard.pieces[c][r];
			if (!pieceData) {
				continue;
			}
			if (pieceData.colour === "black") {
				blackCount++;
				if (pieceData.type === "king") {
					blackKing = true;
				}
			}
			else {
				whiteCount++;
				if (pieceData.type === "king") {
					whiteKing = true;
				}
			}
		}
	}

	return { whiteKing, blackKing, blackCount, whiteCount, valid: whiteKing && blackKing && blackCount > 1 && whiteCount > 1 };
}
function updateArrangementStats() {
	const stats = getArrangementStats()
	if (stats.valid && !arrangementPrevValid) {
		if (localStorage.effects === "true") {
			(async function() {
				arrangementCanvas.confetti({
					spread: 100,
					particleCount: 85,
					startVelocity: 35,
					origin: { x: 0.35, y: 1 },
				})
			})();
			arrangementStats.animate([
				{ transform: "scale(1)" },
				{ opacity: 1 },
				{ opacity: 0 },
				{ transform: "scale(1.2)" },
			], {
				duration: 1000,
				iterations: 1,
			})

			setTimeout(function() {
				if (getArrangementStats().valid) {
					arrangementStats.style.opacity = "1"
				}
			}, 1000)
		}
	}
	else {
		arrangementStats.style.opacity = "0.6"
	}
	arrangementPrevValid = stats.valid
	arrangementStats.innerHTML = `Black pieces: <span style="color:${stats.blackCount > 1 ? 'green' : 'red'}">${stats.blackCount}</span>, White pieces: <span style="color:${stats.whiteCount > 1 ? 'green' : 'red'}">${stats.whiteCount}</span>, White king present: ${stats.whiteKing ? "✅" : "❌"}, Black king present: ${stats.blackKing ? "✅" : "❌"}`
}
updateArrangementStats();

// Settings page
boardThemeSelect.addEventListener("change", function(e) {
	localStorage.boardTheme = boardThemeSelect.value;
});


siteThemeSelect.addEventListener("change", function(e) {
	setTheme(siteThemeSelect.value);
});

settingsResetButton.addEventListener("click", function(e) {
	if (confirm('Are you sure you want to revert all user settings?')) {
		delete localStorage.soundEnabled
		delete localStorage.boardTheme
		delete localStorage.siteTheme
		delete localStorage.serverHostname
		setLocalSettings()
	}
});

accountSignoutButton.addEventListener("click", function(e) {
	if (confirm('Are you sure you want to sign out?')) {
		signout();
	}
});

accountDeleteButton.addEventListener("click", function(e) {
	if (confirm('Are you sure you want to delete your account?')) {
		deleteAccount();
	}
});

// Match panel
createJoinButton.addEventListener("click", async function(e) {
	const lobbyName = createLobbyName.value;
	const matchId = await createMatch(+createRuleset.value, +createArrangement.value, lobbyName, createLobbyCapacity.value, createPublic.checked);
	if (await play(matchId)) {
		switchToGameScreen();
	}
});

function applyLoginUi() {
	loginForm.dataset.disabled = "true";
	profileNeedsLogin.style.display = "none";
	profileContent.style.display = "block";
	settingsContent.style.display = "flex";
	joinLobbyButton.removeAttribute("disabled");
	createMatchButton.removeAttribute("disabled");
	createRulesetButton.removeAttribute("disabled");
	createArrangementButton.removeAttribute("disabled");
	updateMatchList();
	updateUserInfo();
	matchListInterval = setInterval(() => updateMatchList(), 5000);
}

async function updateUserInfo() {
	if (!myToken) {
		return;
	}

	// Fetch stats and profile
	const userRes = await fetch(`${serverAddress}/Users/${myId}`, {
		method: "GET",
		headers: { Authorization: myToken }
	});
	if (!userRes.ok) {
		const message = (await userRes.json())?.message;
		alert("User data fetch failed - " + (message || "network error"));
		return;
	}

	const user = await userRes.json();
	profileGamesPlayed.textContent = user.gamesPlayed;
	profileMatchesWon.textContent = user.matchesWon;
	profilePlayTime.textContent = user.playTime;
	profileUsername.textContent = user.username;
	if (user.profileImageUri) {
		profilePicture.src = `${serverAddress}/${user.profileImageUri}`;
	}
	profileBiography.textContent = user.biography;
	profileGender.value = user.gender || "unknown";
	if (user.location) profileLocation.value = user.location;
	setProfileBackground(user.profileBackground);
}

// https://stackoverflow.com/questions/12710001/how-to-convert-uint8-array-to-base64-encoded-string
/**@param {ArrayBuffer} buffer*/
async function bufferToBase64(buffer) {
	const base64url = await new Promise(resolve => {
		const reader = new FileReader()
		reader.onload = () => resolve(reader.result)
		reader.readAsDataURL(new Blob([buffer]))
	});

	return base64url.slice(base64url.indexOf(',') + 1);
}

/**
 * @param {File} file
 */
async function updateProfilePicture(file) {
	//FileReader.readAsBinaryString()
	let reader = new FileReader();
	reader.onload = async function(event) {
		const resultBytes = new Uint8Array(event.target.result);
		let encodedResult = await bufferToBase64(resultBytes);
		let success = await authedRequest(`Users/${myId}/ProfileImage`,
			"POST", {
			mimeType: file.type,
			data: encodedResult
		}, "Update profile picture failed");
		if (success) {
			profilePicture.src = imageUrl;
			alert("Successfully updated profile picture");
		}
	}
	reader.readAsArrayBuffer(file);
	const imageUrl = URL.createObjectURL(file);
}

/**
 * @param {string} name
 */
async function updateProfileBackground(name) {
	let success = await authedRequest(`Users/${myId}`,
		"POST", { profileBackground: name },
		"Update profile background failed");
	if (success) {
		alert("Successfully updated profile background");
		setProfileBackground(name);
	}
}

/**
 * @param {string} biography
 * @param {string} oldBiography
 */
async function updateProfileBiography(biography, oldBiography) {
	let success = await authedRequest(`Users/${myId}`,
		"POST", { biography: biography },
		"Update profile biography failed");
	if (success) {
		profileBiography.textContent = biography;
		alert("Sucessfully updated profile biography");
	}
	else {
		profileBiography.textContent = oldBiography;
	}
}

/**
 * @param {string|null} name
 */
function setProfileBackground(name = null) {
	const theme = profileThemes[name || "none"];
	profileHeader.style.background = theme.background;
	profileHeader.style.setProperty("--profile-header-cover", theme.cover);
}

/**
 * @param {string} gender
 * @param {string} oldGender
 */
async function updateProfileGender(gender, oldGender) {
	let success = await authedRequest(`Users/${myId}`,
		"POST", { gender: gender },
		"Update profile gender failed");
	if (success) {
		profileGender.value = gender;
		alert("Sucessfully updated profile gender");
	}
	else {
		profileGender.value = oldGender;
	}
}

/**
 * @param {string} location
 * @param {string} oldLocation
 */
async function updateProfileLocation(location, oldLocation) {
	let success = await authedRequest(`Users/${myId}`,
		"POST", { location: location },
		"Update profile location failed");
	if (success) {
		profileLocation.value = location;
		alert("Sucessfully updated profile location");
	}
	else {
		profileLocation.value = oldLocation;
	}
}

/**
 * @param {string} name
 * @param {Object} rulesObject
 */
async function uploadRulesetRules(name, rulesObject) {
	let success = await authedRequest(`Rulesets`,
		"POST", { name: name, rules: JSON.stringify(rulesObject) },
		"Failed to upload ruleset");
	if (success) {
		alert(`Sucessfully uploaded ruleset ${name}`);
	}
}

async function updateCreateRuleset() {
	if (!myToken) {
		throw new Error("Unauthorised");
	}

	const res = await fetch(`${serverAddress}/Users/${myId}/Rulesets`, {
		method: "GET",
		headers: { "Content-Type": "application/json", Authorization: myToken },
	});
	if (!res.ok) {
		const message = (await res.json())?.message;
		alert("Failed to fetch rulesets - " + (message || "network error"));
		return;
	}

	const rulesets = await res.json();
	if (rulesets.length > 0) {
		createRuleset.innerHTML = "";
		appendDefaultOption(createRuleset);
		for (const ruleset of rulesets) {
			const rulesetOption = document.createElement("option");
			rulesetOption.textContent = ruleset.name;
			rulesetOption.value = ruleset.id;
			createRuleset.appendChild(rulesetOption);
		}
	}
}

async function updateCreateArrangement() {
	if (!myToken) {
		throw new Error("Unauthorised");
	}

	const res = await fetch(`${serverAddress}/Users/${myId}/Arrangements`, {
		method: "GET",
		headers: { "Content-Type": "application/json", Authorization: myToken },
	});
	if (!res.ok) {
		const message = (await res.json())?.message;
		alert("Failed to fetch arrangements - " + (message || "network error"));
		return;
	}

	const arrangements = await res.json();
	if (arrangements.length > 0) {
		createArrangement.innerHTML = "";
		appendDefaultOption(createArrangement);
		for (const arrangement of arrangements) {
			const arrangementOption = document.createElement("option");
			arrangementOption.textContent = arrangement.name;
			arrangementOption.value = arrangement.id;
			createArrangement.appendChild(arrangementOption);
		}

	}
}

/**
 * @param {string} name
 * @param {number} columns
 * @param {number} rows
 * @param {PieceData[][]} piecesArray
 */
async function uploadArrangement(name, columns, rows, piecesArray) {
	const stats = getArrangementStats();
	if (!stats.valid) {
		alert(`Could not upload arrangement - Board requirements not satisfied (${stats.blackKing ? 'no' : ''} black king present, ${stats.whiteKing ? 'no' : ''} white king present)`);
		return;
	}
	let success = await authedRequest(`Rulesets`,
		"POST", { name: name, columns: columns, rows: rows, pieces: JSON.stringify(piecesArray) },
		"Failed to upload arrangement");
	if (success) {
		alert(`Sucessfully uploaded arrangement ${name}`);
	}
}

async function deleteAccount() {
	if (!myToken) {
		throw new Error("Unauthorised");
	}

	const res = await fetch(`${serverAddress}/Users/${myId}`, {
		method: "DELETE",
		headers: { Authorization: myToken }
	});
	if (!res.ok) {
		const message = (await res.json())?.message;
		alert("Account deletion failed - " + (message || "network error"));
		return;
	}

	const data = await res.json();
	alert("Success - " + data.message);
	signout();
}

/**
 * @param {number} rulesetId
 * @param {number} arrangementId
 * @param {string} matchName
 * @param {number} capacity
 * @param {boolean} advertisePublic
 */
async function createMatch(rulesetId, arrangementId, matchName, capacity, advertisePublic) {
	if (!myToken) {
		throw new Error("Unauthorised");
	}

	const res = await fetch(`${serverAddress}/Matches`, {
		method: "POST",
		headers: {
			Authorization: myToken,
			"Content-Type": "application/json"
		},
		body: JSON.stringify({ rulesetId, arrangementId, matchName, capacity, advertisePublic })
	});
	if (!res.ok) {
		const message = (await res.json())?.message;
		alert("Failed to create match - " + (message || "network error"));
	}
	let json = await res.json();
	return json.matchId;
}

// AccountId : Profile
const cachedProfiles = new Map();
//  MatchId : Match
const cachedMatches = new Map();
async function updateMatchList() {
	if (!myToken) {
		return;
	}

	const response = await fetch(`${serverAddress}/Matches`, {
		method: "GET",
		headers: { "Authorization": myToken }
	});
	if (!response.ok) {
		if (response.status != 401) {
			console.error("Failed to load matches. Server response was not okay!");
		}
		return;
	}
	const json = await response.json();
	let existingIds = [];
	// Update matchList
	for (const match of json.matches) {
		existingIds.push(match.matchId);
		//  Update previous cached match list item
		const cachedMatchElement = cachedMatches.get(match.matchId);
		if (cachedMatchElement) {
			cachedMatchElement.setAttribute("playerCount", match.playerCount);
		}
		else {
			// Create new match list item
			const matchEl = createFromData("ac-list-match", match);
			matchEl.onplayclicked = function(e) {
				const matchId = +matchEl.getAttribute("matchId");
				play(+matchId);
				switchToGameScreen();
			}
			cachedMatches.set(match.matchId, matchEl);
			matchList.appendChild(matchEl);
		}
	}

	// Delete matches that no longer exist
	for (const [key, value] of cachedMatches) {
		if (!existingIds.includes(key)) {
			cachedMatches.delete(key);
			value.remove();
		}
	}
}

// Updates stats on profile and main pages
async function updateMyStats() {
	const response = await fetch(`${serverAddress}/MyStats`);
	if (!response.ok) {
		console.error("Failed to load my stats. Server response was not okay!");
		return;
	}
	const stats = await response.json();

}
async function updateGlobalStats() {
	const response = await fetch(`${serverAddress}/GlobalStats`);
	if (!response.ok) {
		console.error("Failed to load global stats. Server response was not okay!");
		return;
	}
	const stats = await response.json();
	globalOnlineLabel.textContent = stats.onlinePlayers;
	globalActiveLabel.textContent = stats.activeMatches;
}

/** @param {string} theme*/
function setTheme(theme) {
	document.documentElement.className = theme;
	localStorage.siteTheme = theme;
}

function setLocalSettings() {
	if (localStorage.soundEnabled == undefined) localStorage.soundEnabled = "true";
	if (localStorage.boardTheme == undefined) localStorage.boardTheme = "0";
	if (localStorage.siteTheme == undefined) localStorage.siteTheme = "modernLight";
	if (localStorage.serverHostname == undefined) localStorage.serverHostname = "server.rplace.live/ac";
	if (localStorage.effects == undefined) localStorage.effects = true;
	soundCheckbox.checked = localStorage.soundEnabled === "true";
	effectsCheckbox.checked = localStorage.effects === "true";
	boardThemeSelect.value = localStorage.boardTheme;
	siteThemeSelect.value = localStorage.siteTheme;
	setTheme(localStorage.siteTheme);
	serverInput.value = localStorage.serverHostname;
}

globalStatsInterval = setInterval(updateGlobalStats, 1e4); // 10s
updateGlobalStats();
setLocalSettings();

if (localStorage.me) {
	loginToken();
}
