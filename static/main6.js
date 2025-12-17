console.log("Hello world!")

let socket = null;

let nameSpan = document.getElementById("name");
let pointsSpan = document.getElementById("points");
let historyDiv = document.getElementById("history");
let imageDiv = document.getElementById("image");
let questionDiv = document.getElementById("question");
let choicesDiv = document.getElementById("choices");
let choicesDialog = document.getElementById("choices-dialog");

let nameButton = document.getElementById("name-button");
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

let chart = echarts.init(document.getElementById("chart"), "macarons");

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
	nameSpan.textContent = name;
} else {
	nameSpan.textContent = name;
}

nameButton.onclick = function() {
	name = prompt("Player Name");
	sessionStorage.setItem("name", name);
	nameSpan.textContent = name;
	send("game/rename", {name: name});
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
//for (let i = 0; i < 35; ++i) ticks.push(i);
chart.setOption({
	textStyle: {fontSize: "20px", color: "white", textShadowColor: "white"},
	animationDuration: 100,
	grid: {left: "10px", right: "100px", top: "10px", bottom: "10px"},
	xAxis: {type: 'category', data: ticks, axisLabel: {fontSize: "20px", color: "white"}},
	yAxis: {type: 'value', axisLabel: {fontSize: "20px", color: "white"}, splitLine: {lineStyle: {color: "#777"}}}
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
			if (player.self) attrs["class"] = "self";
			playersBody.appendChild(create("tr", attrs,
				create("td", create("span.name", player.name)),
				create("td", create("span.points", {style: `width:${player.points * 5}px`}, player.points.toString()))
			));
			if (data.state == "Running") player.scores.push(player.points);
			series.push({name: player.name, type: 'line', data: player.scores, showSymbol: true, endLabel: {show: true, formatter: '{a}: {c}', color: "white"}});
		});
		for (let i = 0; i < data.round; ++i) ticks.push(i);
		if (data.state == "Running") ticks.push(data.round);
		chart.setOption({xAxis: {data: ticks}, series});
		if (data.countdown) countdown = {message: data.state, value: data.countdown, limit: data.limit};
		if (data.state == "Choosing") {
			questionDiv.replaceChildren(data.question);
			if (data.image) {
				imageDiv.replaceChildren(create("img", {src: `/questions/${data.image}`}));
			} else {
				imageDiv.removeChildren();
			}
			let choices = data.choices.map(answer => { return {answer}; });
			choicesDiv.replaceChildren(choices.map((choice, index) => {
				choice.index = index + 1;
				choice.element = create("div.choice", choice.answer);
				choice.element.onclick = function(event) {
					choices.forEach(choice => choice.element.removeClass("selected"));
					choice.element.addClass("selected");
					send("round/choose", {choice: choice.index});
				};
				return choice.element;
			}));
			choicesDialog.showModal();
		} else if (data.state == "Marking") {
			questionDiv.replaceChildren(data.question);
			if (data.image) {
				imageDiv.replaceChildren(create("img", {src: `/questions/${data.image}`}));
			} else {
				imageDiv.removeChildren();
			}
			let choices = data.choices.map(answer => { return {answer}; });
			choicesDiv.replaceChildren(choices.map((choice, index) => {
				choice.index = index + 1;
				if (choice.answer == data.answer) {
					choice.element = create("div.choice.correct", choice.answer);
				} else if (choice.answer == data.choice) {
					choice.element = create("div.choice.incorrect", choice.answer);
				} else {
					choice.element = create("div.choice.other", choice.answer);
				}
				return choice.element;
			}));
			choicesDialog.showModal();
		}
	} else {
		playersBody.appendChild(create("tr",
			create("td", create("span.name", data.name)),
			create("td", create("span.points", {style: `width:${data.points * 10}px`}, data.points.toString()))
		));
		series.push({name: data.name, type: 'line', data: data.scores, showSymbol: true, endLabel: {show: true, formatter: '{a}: {c}', color: "white"}});
	}
	chart.setOption({series});
};

events["game/leave"] = function(data) {
	if (data.player) {
		let rows = playersBody.children;
		rows[data.player - 1].remove();
		series.splice(data.player - 1, 1);
		chart.setOption({series});
	} else {
		createButton.style.display = null;
		joinButton.style.display = null;
		leaveButton.style.display = "none";
		startButton.style.display = "none";
		playersBody.removeChildren();
		countdown = null;
		series = [];
		ticks = [];
		chart.setOption({xAxis: {data: ticks}, series});
	}
}

function updateCountdown() {
	if (countdown) {
		let value = (countdown.value -= 0.1);
		countdownSpan.textContent = `${countdown.message} for ${value.toFixed(0)}s ...`;
		countdownProgress.max = countdown.limit;
		countdownProgress.value = value;
	}
}

setInterval(updateCountdown, 100);

let gameState = "";

events["game/state"] = function(data) {
	createButton.style.display = "none";
	joinButton.style.display = "none";
	leaveButton.style.display = null;
	let child;
	while ((child = playersBody.firstChild)) playersBody.removeChild(child);
	if (data.owner && data.state === "Initial") startButton.style.display = null;
	series = [];
	data.players.forEach(player => {
		let attrs = {};
		if (player.self) attrs["class"] = "self";
		playersBody.appendChild(create("tr", attrs,
			create("td", create("span.name", player.name)),
			create("td", create("span.points", {style: `width:${player.points * 5}px`}, player.points.toString()))
		));
		let scores = player.scores;
		series.push({name: player.name, type: 'line', data: scores, showSymbol: true, endLabel: {show: true, formatter: '{a}: {c}', color: "white"}});
	});
	for (let i = 0; i < data.round; ++i) ticks.push(i);
	chart.setOption({xAxis: {data: ticks}, series});
};

events["round/starting"] = function(data) {
	gameState = "starting";
	countdown = {message: "Starting", value: data.countdown, limit: data.limit};
	series.forEach(s => {
		s.data = [];
	});
	chart.setOption({series});
};

events["round/running"] = function(data) {
	choicesDiv.removeChildren();
	pointsSpan.textContent = `You have ${data.points.toString()} points`;
	let rows = playersBody.children;
	data.players.forEach((player, i) => {
		rows[i].firstChild.firstChild.textContent = player.name;
		let span = rows[i].firstChild.nextSibling.firstChild;
		span.textContent = player.points.toString();
		span.style.width = (player.points * 5) + "px";
		series[i].name = player.name;
		series[i].data.push(player.points);
	});
	ticks.push(data.round);
	chart.setOption({xAxis: {data: ticks}, series});
	countdown = {message: "Running", value: data.countdown, limit: data.limit};
	choicesDialog.close();
};

events["round/choosing"] = function(data) {
	if (data.log) data.log.forEach(log => {
		let entry = create("div", {"class": "log"});
		entry.innerHTML = log;
		historyDiv.appendChild(entry);
	});
	historyDiv.scrollTop = historyDiv.scrollHeight;
	pointsSpan.textContent = `You have ${data.points.toString()} points`;
	questionDiv.replaceChildren(data.question);
	if (data.image) {
		imageDiv.replaceChildren(create("img", {src: `/questions/${data.image}`}));
	} else {
		imageDiv.removeChildren();
	}
	let choices = data.choices.map(answer => { return {answer}; });
	choicesDiv.replaceChildren(choices.map((choice, index) => {
		choice.index = index + 1;
		choice.element = create("div.choice", choice.answer);
		choice.element.onclick = function(event) {
			choices.forEach(choice => choice.element.removeClass("selected"));
			choice.element.addClass("selected");
			send("round/choose", {choice: choice.index});
		};
		return choice.element;
	}));
	choicesDialog.showModal();
	let rows = playersBody.children;
	data.players.forEach((player, i) => {
		rows[i].firstChild.firstChild.textContent = player.name;
		let span = rows[i].firstChild.nextSibling.firstChild;
		span.textContent = player.points.toString();
		span.style.width = (player.points * 5) + "px";
	});
	chart.setOption({series});
	countdown = {message: "Choosing", value: data.countdown, limit: data.limit};
};

events["round/choose"] = function(data) {
};

events["round/marking"] = function(data) {
	if (data.log) data.log.forEach(log => {
		let entry = create("div", {"class": "log"});
		entry.innerHTML = log;
		historyDiv.appendChild(entry);
	});
	historyDiv.scrollTop = historyDiv.scrollHeight;
	pointsSpan.textContent = `You have ${data.points.toString()} points`;
	questionDiv.replaceChildren(data.question);
	if (data.image) {
		imageDiv.replaceChildren(create("img", {src: `/questions/${data.image}`}));
	} else {
		imageDiv.removeChildren();
	}
	let choices = data.choices.map(answer => { return {answer}; });
	choicesDiv.replaceChildren(choices.map((choice, index) => {
		choice.index = index + 1;
		if (choice.answer == data.answer) {
			choice.element = create("div.choice.correct", choice.answer);
		} else if (choice.answer == data.choice) {
			choice.element = create("div.choice.incorrect", choice.answer);
		} else {
			choice.element = create("div.choice.other", choice.answer);
		}
		return choice.element;
	}));
	choicesDialog.showModal();
	let rows = playersBody.children;
	data.players.forEach((player, i) => {
		rows[i].firstChild.firstChild.textContent = player.name;
		let span = rows[i].firstChild.nextSibling.firstChild;
		span.textContent = player.points.toString();
		span.style.width = (player.points * 5) + "px";
	});
	chart.setOption({series});
	countdown = {message: "Marking", value: data.countdown, limit: data.limit};
};

function resultRow(player, i) {
	if (player.word === null) {
		return {
			score: -1,
			element: create("div.score-row", {style: `top:${i * 38}px`},
				create("span.position", "?. "),
				create("span.name", player.name),
				create("span.score", "")
			)
		};
	} else {
		return {
			score: player.points,
			element: create("div.score-row", {style: `top:${i * 38}px`},
				create("span.position", "?. "),
				create("span.name", player.name),
				create("span.score", {style: `width: ${player.points * 2}px`}, player.points.toString())
			)
		};
	}
}

events["round/scoring"] = function(data) {
	gameState = "scoring";
	countdown = {message: "Scoring", value: data.countdown, limit: data.limit};
	choicesDialog.close();
	let rows = playersBody.children;
	data.players.forEach((player, i) => {
		let span = rows[i].firstChild.nextSibling.firstChild;
		span.textContent = player.points.toString();
		span.style.width = (player.points * 5) + "px";
		series[i].name = player.name;
	})
	chart.setOption({series});
	let scores = data.players.map(resultRow);
	scoreTable.style.height = (scores.length * 38) + 20 + "px";
	scoreTable.replaceChildren(scores.map(score => score.element));
	scoreDialog.showModal();
	setTimeout(function() {
		scores.sort((a, b) => b.score - a.score);
		let previous = 1000000;
		let position = 0;
		scores.forEach((score, i) => {
			score.element.style.top = i * 38 + "px";
			if (score.score < previous) {
				position = i + 1;
				previous = score.score;
			}
			score.element.firstChild.textContent = `${position}. `;
		});
	}, 500);
};

events["game/history"] = function(data) {
	data.forEach(data => {
		let round = data.round;
		let log = data.log;
		historyDiv.appendChild(create("h3", round));
		historyDiv.appendChild(create("hr"));
		if (log) log.forEach(log => {
			let entry = create("div", {"class": "log"});
			entry.innerHTML = log;
			historyDiv.appendChild(entry);
		});
	});
	historyDiv.scrollTop = historyDiv.scrollHeight;
};

events["round/ending"] = function(data) {
	gameState = "ending";
	let rows = playersBody.children;
	data.players.forEach((player, i) => {
		let span = rows[i].firstChild.nextSibling.firstChild;
		span.textContent = player.points.toString();
		span.style.width = (player.points * 5) + "px";
	})
	let tbody = create("tbody");
	while (scoreTable.firstChild) tbody.appendChild(scoreTable.firstChild);
	historyDiv.appendChild(create("table", tbody));
	historyDiv.scrollTop = historyDiv.scrollHeight;
	countdown = {message: "Ending", value: data.countdown, limit: data.limit};
	scoreDialog.close();
};
