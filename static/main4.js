console.log("Hello world!")

let socket = null;

let wordsSpan = document.getElementById("words");
let dictionariesSpan = document.getElementById("dictionaries");
let historyDiv = document.getElementById("history");
let choicesDiv = document.getElementById("choices");
let choicesDialog = document.getElementById("choices-dialog");

let createButton = document.getElementById("create-button");
let joinButton = document.getElementById("join-button");
let startButton = document.getElementById("start-button");
let leaveButton = document.getElementById("leave-button");

let joinDialog = document.getElementById("join-dialog");
let joinTable = document.getElementById("join-table");
let scoreDialog = document.getElementById("score-dialog");
let scoreTable = document.getElementById("score-table");
let playersBody = document.getElementById("players");
let countdownSpan = document.getElementById("countdown-message");
let countdownProgress = document.getElementById("countdown-progress");
let countdown;

let chart = echarts.init(document.getElementById("chart"), {
	width: 800,
	height: 600
});

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

let ticks = [];
for (let i = 0; i < 120; ++i) ticks.push(i);
chart.setOption({
	animationDuration: 10000,
	xAxis: {type: 'category', data: ticks, axisLabel: {fontsize: 16}},
	yAxis: {type: 'value', axisLabel: {fontsize: 16}}
});
let series = [];

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
				create("td", attrs, create("span.words", {style: `width:${player.words}px`}, player.words.toString()))
			));
			series.push({name: player.name, type: 'line', data: [], showSymbol: false, endLabel: {show: true, fontsize: 16, formatter: '{a}: {c}'}});
		});
		if (data.countdown) countdown = {message: data.state, value: data.countdown, limit: data.limit};
	} else {
		playersBody.appendChild(create("tr",
			create("td", data.name),
			create("td", create("span.words", {style: `width:${data.words}px`}, data.words.toString()))
		));
		series.push({name: data.name, type: 'line', data: [], showSymbol: false, fontsize: 16, endLabel: {show: true, formatter: '{a}: {c}'}});
	}
	chart.setOption({series});
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

let gameState = "";

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
			create("td", attrs, create("span.words", {style: `width:${player.words}px`}, player.words.toString()))
		));
	});
};

events["round/starting"] = function(data) {
	gameState = "starting";
	countdown = {message: "Starting", value: data.countdown, limit: data.limit};
	series.forEach(s => {
		s.data = [];
	});
	chart.setOption({series});
};

let pointsInterval;

events["round/running"] = function(data) {
	choicesDiv.removeChildren();
	wordsSpan.textContent = data.words.toString();
	dictionariesSpan.textContent = data.dictionaries.toString();
	let rows = playersBody.children;
	data.players.forEach((player, i) => {
		let span = rows[i].firstChild.nextSibling.firstChild;
		span.textContent = player.words.toString();
		span.style.width = player.words + "px";
		series[i].data.push(player.words);
	});
	chart.setOption({series});
	historyDiv.appendChild(create("h3", `Round ${data.round}`));
	historyDiv.appendChild(create("hr"));
	if (data.log) data.log.forEach(log => {
		let entry = create("div", {"class": "log"});
		entry.innerHTML = log;
		historyDiv.appendChild(entry);
	});
	if (pointsInterval == null) pointsInterval = setInterval(() => {
		data.players.forEach((player, i) => {
			player.words += player.dictionaries;
			let span = rows[i].firstChild.nextSibling.firstChild;
			span.textContent = player.words.toString();
			span.style.width = player.words + "px";
			wordsSpan.textContent = player.words.toString();
			series[i].data.push(player.words);
		});
		chart.setOption({series});
	}, 1000);
	// TODO: update words over time here
	countdown = {message: "Running", value: data.countdown, limit: data.limit};
	choicesDialog.close();
};

events["round/choosing"] = function(data) {
	if (data.log) data.log.forEach(log => {
		let entry = create("div", {"class": "log"});
		entry.innerHTML = log;
		historyDiv.appendChild(entry);
	});
	wordsSpan.textContent = data.words.toString();
	dictionariesSpan.textContent = data.dictionaries.toString();
	let choices = data.choices;
	choicesDiv.replaceChildren(choices.map((choice, index) => {
		choice.index = index + 1;
		let name = create("div.name");
		name.innerHTML = choice.name;
		let description = create("div.description");
		description.innerHTML = choice.description;
		choice.element = create("div.choice",
			name,
			create("img.image", {src: `/cards/${choice.image}.png`}),
			description,
			create("div.cost", choice.cost)
		);
		choice.element.onclick = function(event) {
			choices.forEach(choice => choice.element.removeClass("selected"));
			choice.element.addClass("selected");
			send("round/choose", {choice: choice.index});
		};
		return choice.element;
	}));
	choicesDialog.showModal();
	if (pointsInterval != null) {
		clearInterval(pointsInterval);
		pointsInterval = null;
	}
	let rows = playersBody.children;
	data.players.forEach((player, i) => {
		let span = rows[i].firstChild.nextSibling.firstChild;
		span.textContent = player.words.toString();
		span.style.width = player.words + "px";
		series[i].data.push(player.words);
	});
	chart.setOption({series});
	countdown = {message: "Choosing", value: data.countdown, limit: data.limit};
};

events["round/choose"] = function(data) {
};

function resultRow(player, i) {
	if (player.word === null) {
		return {
			score: -1,
			element: create("div.score-row", {style: `top:${i * 38}px`},
				create("span.name", player.name),
				create("span.score", "")
			)
		};
	} else {
		return {
			score: player.score,
			element: create("div.score-row", {style: `top:${i * 38}px`},
				create("span.name", player.name),
				create("span.score", player.words.toString())
			)
		};
	}
}

events["round/scoring"] = function(data) {
	gameState = "scoring";
	countdown = {message: "Scoring", value: data.countdown, limit: data.limit};
	choicesDialog.close();
	if (data.log) data.log.forEach(log => {
		let entry = create("div", {"class": "log"});
		entry.innerHTML = log;
		historyDiv.appendChild(entry);
	});
	if (pointsInterval != null) {
		clearInterval(pointsInterval);
		pointsInterval = null;
	}
	let rows = playersBody.children;
	data.players.forEach((player, i) => {
		let span = rows[i].firstChild.nextSibling.firstChild;
		span.textContent = player.words.toString();
		span.style.width = player.words + "px";
	})
	let scores = data.players.map(resultRow);
	scoreTable.style.height = (scores.length * 38) + 20 + "px";
	scoreTable.replaceChildren(scores.map(score => score.element));
	scoreDialog.showModal();
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
		span.textContent = player.words.toString();
		span.style.width = player.words + "px";
	})
	let tbody = create("tbody");
	while (scoreTable.firstChild) tbody.appendChild(scoreTable.firstChild);
	historyDiv.appendChild(create("table", tbody));
	historyDiv.scrollTop = historyDiv.scrollHeight;
	countdown = {message: "Ending", value: data.countdown, limit: data.limit};
	scoreDialog.close();
};
