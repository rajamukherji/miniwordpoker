console.log("Hello world!")

let socket = null;

let gameBoard = document.getElementById("game-board");
let wordBoard = document.getElementById("word-board");
let wordScore = document.getElementById("word-score");
let bestScore = document.getElementById("best-score");
let fundSpan = document.getElementById("fund");
let bidSpan = document.getElementById("bid");

let createButton = document.getElementById("create-button");
let joinButton = document.getElementById("join-button");
let startButton = document.getElementById("start-button");
let endButton = document.getElementById("end-button");

let joinDialog = document.getElementById("join-dialog");
let joinTable = document.getElementById("join-table");
let scoreDialog = document.getElementById("score-dialog");
let scoreTable = document.getElementById("score-table");
let playersBody = document.getElementById("players");
let countdownSpan = document.getElementById("countdown");
let countdown;

let currentBid = document.getElementById("current-bid");
let bidButton = document.getElementById("bid-button");

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
endButton.style.display = "none";

createButton.onclick = function() {
	createButton.style.display = "none";
	joinButton.style.display = "none";
	send("game/create", {name: prompt("Game Name")});
};

startButton.onclick = function() {
	startButton.style.display = "none";
	send("game/start", {});
};

startButton.style.display = "none";

joinButton.onclick = function() {
	joinDialog.showModal();
	send("game/list", {});
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
		let child;
		while ((child = playersBody.firstChild)) playersBody.removeChild(child);
		if (data.owner && data.state === "Initial") startButton.style.display = null;
		data.players.forEach(player => {
			let attrs = {};
			if (player.self) attrs["style"] = "font-weight:bold;color:red;";
			playersBody.appendChild(create("tr",
				create("td", attrs, player.name),
				create("td", attrs, create("span.fund", {style: `width:${player.fund}px`}, "$" + player.fund.toString()))
			));
		});
	} else {
		playersBody.appendChild(create("tr",
			create("td", data.name),
			create("td", create("span.fund", {style: `width:${data.fund}px`}, "$" + data.fund.toString()))
		));
	}
};

events["game/state"] = function(data) {
	createButton.style.display = "none";
	joinButton.style.display = "none";
	let child;
	while ((child = playersBody.firstChild)) playersBody.removeChild(child);
	if (data.owner && data.state === "Initial") startButton.style.display = null;
	data.players.forEach(player => {
		let attrs = {};
		if (player.self) attrs["style"] = "font-weight:bold;color:red;";
		playersBody.appendChild(create("tr",
			create("td", attrs, player.name),
			create("td", attrs, create("span.fund", {style: `width:${player.fund}px`}, "$" + player.fund.toString()))
		));
	});
	if (data.bid) bidSpan.textContent = "$" + data.bid.toString();
	if (data.word) {
		bestScore.replaceChildren("Current best word is ", create("span.word", data.word), " with ", create("span.score", data.score.toString()), " points.");
	}
	if (data.countdown) countdown = {message: data.state, value: data.countdown};
};

setInterval(function() {
	if (countdown) countdownSpan.textContent = `${countdown.message} for ${countdown.value--}s ...`;
}, 1000);

events["round/starting"] = function(data) {
	let child;
	while ((child = gameBoard.firstChild)) gameBoard.removeChild(child);
	while ((child = wordBoard.firstChild)) wordBoard.removeChild(child);
	countdown = {message: "Starting", value: data.countdown};
};

const values = {
	a: 1, b: 3, c: 3, d: 2, e: 1, f: 4, g: 2, h: 4, i: 1, j: 8, k: 5, l: 1, m: 3,
	n: 1, o: 1, p: 3, q: 10, r: 1, s: 1, t: 1, u: 1, v: 4, w: 4, x: 8, y: 4, z: 10
};

events["round/playing"] = function(data) {
	fundSpan.textContent = data.fund.toString();
	data.board.forEach(letter => {
		gameBoard.appendChild(create("span.letter", {letter},
			letter.toUpperCase(),
			create("span.score", values[letter].toString())
		));
	});
	data.hand.forEach(letter => {
		gameBoard.appendChild(create("span.letter.hand", {letter},
			letter.toUpperCase(),
			create("span.score", values[letter].toString())
		));
	});
	bidSpan.textContent = "$" + data.bid.toString();
	bidButton.textContent = `Change Bid to ${data.bid}`;
	currentBid.min = data.bid;
	currentBid.max = data.fund;
	currentBid.value = data.bid;
	countdown = {message: "Playing", value: data.countdown};
};

currentBid.oninput = function(event) {
	bidButton.textContent = `Change Bid to $${currentBid.value}`;
}

bidButton.onclick = function(event) {
	send("round/bid", {bid: parseInt(currentBid.value)});
}

let drake = dragula([gameBoard, wordBoard], {direction: "horizontal"}).on("shadow", function() {
	let children = wordBoard.children;
	let word = "";
	for (let i = 0; i < children.length; ++i) word += children[i].getAttribute("letter");
	send("round/word", {word});
});

function renderWord(word) {
	return create("span.word", word.split("").map(letter => create("span.letter", {letter},
		letter.toUpperCase(),
		create("span.score", values[letter].toString())
	)));
}

events["round/word"] = function(data) {
	if (data.score > 0) {
		wordScore.replaceChildren(create("span.word", renderWord(data.word)), " is worth ", create("span.word-score", data.score.toString()), " points!");
	} else {
		wordScore.replaceChildren(create("span.word", renderWord(data.word)), " not found in dictionary.");
	}
	bestScore.replaceChildren("Current best word is ", create("span.word", renderWord(data.bestWord)), " with ", create("span.word-score", data.bestScore.toString()), " points.");
};

events["round/bid"] = function(data) {
	bidSpan.textContent = "$" + data.bid.toString();
};

events["round/scoring"] = function(data) {
	countdown = {message: "Scoring", value: data.countdown};
	let scores = data.players.map((player, i) => {
		return {
			score: player.score,
			element: create("div.score-row", {style: `top:${i * 35}px`},
				create("span.name", player.name),
				create("span.word", renderWord(player.word)),
				create("span.score", player.score.toString()),
				create("span.bid", "$" + player.bid.toString())
			)
		};
	});
	scoreTable.style.height = (scores.length * 35) + 20 + "px";
	scoreTable.replaceChildren(scores.map(score => score.element));
	scoreDialog.showModal();
	setTimeout(function() {
		scores.sort((a, b) => b.score - a.score);
		scores.forEach((score, i) => {
			score.element.style.top = i * 35 + "px";
		});
	}, 2000);
};

events["round/ending"] = function(data) {
	let rows = playersBody.children;
	data.players.forEach((player, i) => {
		let span = rows[i].firstChild.nextSibling.firstChild;
		span.textContent = player.fund.toString();
		span.style.width = player.fund + "px";
	})
	countdown = {message: "Ending", value: data.countdown};
	scoreDialog.close();
};
