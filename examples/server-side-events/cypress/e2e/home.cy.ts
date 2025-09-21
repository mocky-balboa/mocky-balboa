it("updates the message in the UI when messages are received from the SSE endpoint", () => {
	cy.mocky((mocky) => {
		mocky.route("http://localhost:3000/endpoint", (route) => {
			return route.fulfill({
				status: 200,
				body: JSON.stringify({ message: "This is just a test" }),
			});
		});
	});

	cy.mockySSE(() => {
		cy.visit("http://localhost:3000");
		cy.get("#start").click();
		cy.get("#start-endpoint").click();
		cy.contains("This is just a test");
		return cy.wait(1000);
	}, "http://localhost:3000/sse").then((sse) => {
		cy.wrap(sse).as("sse");
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
