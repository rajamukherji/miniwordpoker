Element.prototype.remove = function() {
	if (this.parentNode) this.parentNode.removeChild(this);
};

Element.prototype.removeAfterTransition = function() {
	var element = this;
	function remove() {
		element.removeEventListener("webkitTransitionEnd", remove);
		element.removeEventListener("transitionend", remove);
		element.remove();
	}
	element.addEventListener("webkitTransitionEnd", remove);
	element.addEventListener("transitionend", remove);
};

Element.prototype.replace = function(other) {
	if (this.parentNode) this.parentNode.replaceChild(other, this);
};

Element.prototype.appendChildren = function() {
	Array.prototype.forEach.call(arguments, child => {
		if (!child) {
		} else if (child instanceof Array) {
			this.appendChildren.apply(this, child);
		} else if (typeof child === "string") {
			this.appendChild(document.createTextNode(child));
		} else {
			this.appendChild(child);
		}
	});
};

Element.prototype.removeChildren = function() {
	var child;
	while (child = this.firstChild) this.removeChild(child);
};

Element.prototype.replaceChildren = function() {
	this.removeChildren();
	this.appendChildren.apply(this, arguments);
};

Element.prototype.prependChild = function(child) {
	return this.insertBefore(child, this.firstChild);
};

Element.prototype.insertAfter = function(child, after) {
	return this.insertBefore(child, after.nextSibling);
};

Element.prototype.addClass = function(_class) {
	this.classList.add(_class);
};

Element.prototype.removeClass = function(_class) {
	this.classList.remove(_class);
};

Element.prototype.toggleClass = function(_class) {
	this.classList.toggle(_class);
};

function create(tag) {
	let classes = tag.split(".");
	let element = document.createElement(classes[0]);
	for (var i = 1; i < classes.length; ++i) element.addClass(classes[i]);

	function process(arg) {
		if (arg === null) {
		} else if (arg instanceof Array) {
			arg.forEach(process);
		} else if (arg instanceof Element) {
			element.appendChild(arg);
		} else if (typeof arg === "string") {
			element.appendChild(document.createTextNode(arg));
		} else if (typeof arg === "object") {
			for (var key in arg) {
				let value = arg[key];
				if (key.startsWith("on-")) {
					element.addEventListener(key.substring(3), value);
				} else if (key.startsWith("prop-")) {
					element.setProperty(key.substring(5), value);
				} else {
					element.setAttribute(key, value);
				}
			}
		}
	}
	for (var j = 1; j < arguments.length; ++j) process(arguments[j]);
	return element;
}
