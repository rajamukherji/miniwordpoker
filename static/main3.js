console.log("Hello world!")

let socket = null;

let gameBoard = document.getElementById("game-board");
let wordBoard = document.getElementById("word-board");
let wordScore = document.getElementById("word-score");
let bestScore = document.getElementById("best-score");
let pointsSpan = document.getElementById("points");
let historyDiv = document.getElementById("history");

let createButton = document.getElementById("create-button");
let joinButton = document.getElementById("join-button");
let startButton = document.getElementById("start-button");
let leaveButton = document.getElementById("leave-button");
let clearButton = document.getElementById("clear-button");

let joinDialog = document.getElementById("join-dialog");
let joinTable = document.getElementById("join-table");
let scoreDialog = document.getElementById("score-dialog");
let scoreTable = document.getElementById("score-table");
let playersBody = document.getElementById("players");
let countdownSpan = document.getElementById("countdown-message");
let countdownProgress = document.getElementById("countdown-progress");
let countdown;

let scoreCache = {};

let events = {};
function connect(callback) {
	socket = new WebSocket(((window.location.protocol === "https:") ? "wss://" : "ws://") + window.location.host + "/connect?id=" + id + "&name=" + encodeURIComponent(name));
	socket.onmessage = function(message) {
		let decoded = JSON.parse(message.data);
		for (type in decoded) events[type](decoded[type]);
	}
	socket.onopen = function() {
		ping = Date.now();
		socket.send(JSON.stringify({ping: null}));
		if (callback) callback();
	}
	return socket;
}

let id = sessionStorage.getItem("id");
if (id === null) {
	let arr = new Uint8Array(16);
	window.crypto.getRandomValues(arr);
	id = Array.from(arr).map(x => x.toString(16).padStart(2, "0")).join("");
	sessionStorage.setItem("id", id);
}
let name = sessionStorage.getItem("name");
if (name === null) {
	name = prompt("Player Name");
	sessionStorage.setItem("name", name);
}

connect();

function send(event, data) {
	if (socket.readyState != 1) {
		connect(send.bind(null, ...arguments));
	} else {
		let message = {};
		message[event] = data;
		socket.send(JSON.stringify(message));
	}
}

window.send = send;

startButton.style.display = "none";
leaveButton.style.display = "none";

createButton.onclick = function() {
	createButton.style.display = "none";
	joinButton.style.display = "none";
	send("game/create", {name: prompt("Game Name")});
};

startButton.onclick = function() {
	startButton.style.display = "none";
	leaveButton.style.display = null;
	send("game/start", {});
};

startButton.style.display = "none";

joinButton.onclick = function() {
	joinDialog.showModal();
	send("game/list", {});
};

leaveButton.onclick = function() {
	createButton.style.display = null
	joinButton.style.display = null;
	leaveButton.style.display = "none";
	send("game/leave", {});
};

clearButton.onclick = function() {
	while (wordBoard.firstChild) gameBoard.appendChild(wordBoard.firstChild);
};

events["pong"] = function(data) {
	lag = (Date.now() - ping) / 2000;
	console.log("delay", lag);
}

logs = document.getElementById("logs");

events["connect"] = function(data) {
};

events["game/create"] = function(data) {
	startButton.style.display = null;
};

events["game/list"] = function(data) {
	let child;
	while ((child = joinTable.firstChild)) joinTable.removeChild(child);
	data.forEach(game => {
		joinTable.appendChild(create("tr",
			create("td", game.name),
			create("td", game.count.toString() + " players"),
			create("td", create("button", "Join", {"on-click": function() {
				joinDialog.close();
				send("game/join", {id: game.id});
			}}))
		));
	});
	if (joinDialog.open) setTimeout(() => send("game/list", {}), 1000);
};

events["game/join"] = function(data) {
	if (data.players) {
		createButton.style.display = "none";
		joinButton.style.display = "none";
		leaveButton.style.display = null;
		let child;
		while ((child = playersBody.firstChild)) playersBody.removeChild(child);
		if (data.owner && data.state === "Initial") startButton.style.display = null;
		data.players.forEach(player => {
			let attrs = {};
			if (player.self) attrs["style"] = "font-weight:bold;color:red;";
			playersBody.appendChild(create("tr",
				create("td", attrs, player.name),
				create("td", attrs, create("span.points", {style: `width:${player.points}px`}, "$" + player.points.toString()))
			));
		});
		if (data.countdown) countdown = {message: data.state, value: data.countdown, limit: data.limit};
	} else {
		playersBody.appendChild(create("tr",
			create("td", data.name),
			create("td", create("span.points", {style: `width:${data.points}px`}, "$" + data.points.toString()))
		));
	}
};

events["game/leave"] = function(data) {
	if (data.player) {
		let rows = playersBody.children;
		if (rows.length >= data.player) rows[data.player - 1].remove();
	} else {
		createButton.style.display = null;
		joinButton.style.display = null;
		leaveButton.style.display = "none";
		startButton.style.display = "none";
		gameBoard.removeChildren();
		wordBoard.removeChildren();
		wordScore.removeChildren();
		bestScore.removeChildren();
		playersBody.removeChildren();
		countdown = null;
	}
}

setInterval(function() {
	if (countdown) {
		countdownSpan.textContent = `${countdown.message} for ${countdown.value--}s ...`;
		countdownProgress.max = countdown.limit;
		countdownProgress.value = countdown.value;
	}
}, 1000);

const values = {
	a: 1, b: 3, c: 3, d: 2, e: 1, f: 4, g: 2, h: 4, i: 1, j: 8, k: 5, l: 1, m: 3,
	n: 1, o: 1, p: 3, q: 10, r: 1, s: 1, t: 1, u: 1, v: 4, w: 4, x: 8, y: 4, z: 10
};

let gameState = "";

function scoreWord(word) {
	switch (gameState) {
	case "swapping":
		send("round/swap", {letters: word});
		break;
	case "playing":
		if (scoreCache[word]) return;
		scoreCache[word] = true;
		send("round/word", {word});
		break;
	}
}

document.onkeydown = function(event) {
	let letter = event.key;
	if (letter === "Backspace" || letter === "Delete") {
		if (wordBoard.lastChild) gameBoard.appendChild(wordBoard.lastChild);
	} else if (letter === "Escape") {
		while (wordBoard.firstChild) gameBoard.appendChild(wordBoard.firstChild);
	} else if (gameState == "swapping" && wordBoard.children.length >= 3) {
	} else {
		let children = gameBoard.children;
		for (let i = 0; i < children.length; ++i) {
			if (children[i].getAttribute("letter") === letter) {
				wordBoard.appendChild(children[i]);
				let children2 = wordBoard.children;
				let word = "";
				for (let i = 0; i < children2.length; ++i) word += children2[i].getAttribute("letter");
				scoreWord(word);
				break;
			}
		}
	}
}

function moveLetter(event) {
	let element = event.currentTarget;
	if (element.parentNode === gameBoard) {
		if (gameState == "swapping" && wordBoard.children.length >= 3) return;
		wordBoard.appendChild(element);
	} else {
		gameBoard.appendChild(element);
	}
	let children = wordBoard.children;
	let word = "";
	for (let i = 0; i < children.length; ++i) word += children[i].getAttribute("letter");
	scoreWord(word);
}

function moveAllowed(el, target, source, sibling) {
	if (gameState == "swapping" && target == wordBoard && wordBoard.children.length >= 3) return false;
	return true;
}

let drake = dragula([gameBoard, wordBoard], {direction: "horizontal", accepts: moveAllowed}).on("shadow", function() {
	let children = wordBoard.children;
	let word = "";
	for (let i = 0; i < children.length; ++i) word += children[i].getAttribute("letter");
	scoreWord(word);
});

function renderWord(word, board) {
	let counts = {};
	(board || word.split("")).forEach(letter => { counts[letter] = (counts[letter] || 0) + 1; });
	return create("span.word", word.split("").map(letter => {
		let tag = "span.letter";
		if (counts[letter]) {
			--counts[letter];
		} else {
			tag += ".hand";
		}
		return create(tag, {letter},
			letter.toUpperCase(),
			create("span.score", values[letter].toString())
		);
	}));
}

events["game/state"] = function(data) {
	createButton.style.display = "none";
	joinButton.style.display = "none";
	leaveButton.style.display = null;
	let child;
	while ((child = playersBody.firstChild)) playersBody.removeChild(child);
	if (data.owner && data.state === "Initial") startButton.style.display = null;
	data.players.forEach(player => {
		let attrs = {};
		if (player.self) attrs["style"] = "font-weight:bold;color:red;";
		playersBody.appendChild(create("tr",
			create("td", attrs, player.name),
			create("td", attrs, create("span.points", {style: `width:${player.points}px`}, player.points.toString()))
		));
	});
	if (data.word) bestScore.replaceChildren("Current best word is ", create("span.word", renderWord(data.word)), " with ", create("span.score", data.score.toString()), " points.");
	if (data.countdown) countdown = {message: data.state, value: data.countdown, limit: data.limit};
};

events["round/starting"] = function(data) {
	gameState = "starting";
	let child;
	while ((child = gameBoard.firstChild)) gameBoard.removeChild(child);
	while ((child = wordBoard.firstChild)) wordBoard.removeChild(child);
	countdown = {message: "Starting", value: data.countdown, limit: data.limit};
	scoreCache = {};
};

events["round/swapping"] = function(data) {
	gameState = "swapping";
	pointsSpan.textContent = data.points.toString();
	if (data.board) {
		data.board.forEach(letter => {
			gameBoard.appendChild(create("span.letter", {letter, "on-click": moveLetter},
				letter.toUpperCase(),
				create("span.score", values[letter].toString())
			));
		});
	}
	countdown = {message: "Swapping", value: data.countdown, limit: data.limit};
};

events["round/playing"] = function(data) {
	gameState = "playing";
	pointsSpan.textContent = data.points.toString();
	let child;
	while ((child = gameBoard.firstChild)) gameBoard.removeChild(child);
	while ((child = wordBoard.firstChild)) wordBoard.removeChild(child);
	if (data.board) {
		data.board.forEach(letter => {
			gameBoard.appendChild(create("span.letter", {letter, "on-click": moveLetter},
				letter.toUpperCase(),
				create("span.score", values[letter].toString())
			));
		});
		if (data.word) bestScore.replaceChildren("Current best word is ", create("span.word", renderWord(data.word)), " with ", create("span.word-score", data.score.toString()), " points.");
	}
	countdown = {message: "Playing", value: data.countdown, limit: data.limit};
};

events["round/swap"] = function(data) {
};

events["round/word"] = function(data) {
	if (data.score > 0) {
		wordScore.replaceChildren(create("span.word", renderWord(data.word)), " is worth ", create("span.word-score", data.score.toString()), " points!");
	} else {
		wordScore.replaceChildren(create("span.word", renderWord(data.word)), " not found in dictionary.");
	}
	bestScore.replaceChildren("Current best word is ", create("span.word", renderWord(data.bestWord)), " with ", create("span.word-score", data.bestScore.toString()), " points.");
};

function resultRow(player, i) {
	if (player.word === null) {
		return {
			score: -1,
			element: create("div.score-row", {style: `top:${i * 38}px`},
				create("span.name", player.name),
				create("span.word", ""),
				create("span.score", ""),
				create("span.damage", ""),
				create("span.best-word", ""),
				create("span.best-score", ""),
				create("span.shield", "")
			)
		};
	} else {
		return {
			score: player.score,
			element: create("div.score-row", {style: `top:${i * 38}px`},
				create("span.name", player.name),
				create("span.word", renderWord(player.word)),
				create("span.score", player.score.toString()),
				create("span.damage", player.damage.toString()),
				create("span.best-word", renderWord(player.best.word)),
				create("span.best-score", player.best.score.toString()),
				create("span.shield", player.shield.toString())
			)
		};
	}
}

events["round/scoring"] = function(data) {
	gameState = "scoring";
	countdown = {message: "Scoring", value: data.countdown, limit: data.limit};
	let scores = data.players.map(resultRow);
	scoreTable.style.height = (scores.length * 38) + 20 + "px";
	scoreTable.replaceChildren(scores.map(score => score.element));
	scoreDialog.showModal();
	historyDiv.appendChildren(create("h3", `Round ${data.round}`));
	historyDiv.scrollTop = historyDiv.scrollHeight;
	setTimeout(function() {
		scores.sort((a, b) => b.score - a.score);
		scores.forEach((score, i) => {
			score.element.style.top = i * 38 + "px";
		});
	}, 500);
};

events["game/history"] = function(data) {
	data.forEach((players, round) => {
		historyDiv.appendChildren(create("h3", `Round ${round + 1}`));
		let tbody = create("tbody", players.map(resultRow).map(x => x.element));
		historyDiv.appendChild(create("table", tbody));
	});
	historyDiv.scrollTop = historyDiv.scrollHeight;
};

events["round/ending"] = function(data) {
	gameState = "ending";
	let rows = playersBody.children;
	data.players.forEach((player, i) => {
		let span = rows[i].firstChild.nextSibling.firstChild;
		span.textContent = player.points.toString();
		span.style.width = player.points + "px";
	})
	let tbody = create("tbody");
	while (scoreTable.firstChild) tbody.appendChild(scoreTable.firstChild);
	historyDiv.appendChild(create("table", tbody));
	historyDiv.scrollTop = historyDiv.scrollHeight;
	countdown = {message: "Ending", value: data.countdown, limit: data.limit};
	gameBoard.removeChildren();
	wordBoard.removeChildren();
	wordScore.removeChildren();
	bestScore.removeChildren();
	scoreDialog.close();
};
