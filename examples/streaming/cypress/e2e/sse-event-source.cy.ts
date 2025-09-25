it("updates the message in the UI when messages are received from the SSE endpoint", () => {
	cy.mockySSE(() => {
		cy.visit("http://localhost:3000/sse-event-source.html");
		return cy.get("#start").click();
	}, "http://localhost:3000/sse").then((sse) => {
		cy.then(() =>
			sse.dispatchEvent("message", "This is a message from the server"),
		);
		cy.contains("This is a message from the server");
		cy.then(() =>
			sse.dispatchEvent("message", "Another message from the server"),
		);
		cy.contains("Another message from the server");
	});
});
