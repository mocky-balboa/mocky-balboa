it("shows messages when messages are handled via the WebSocket server", () => {
	cy.mockyWebSocket(() => {
		cy.visit("http://localhost:3000/server-websocket.html");
		return cy.get("#open-websocket").click();
	}, "ws://acme.org/socket").then((websocketHelper) => {
		cy.get("#start-streaming").click();
		cy.contains("ready");

		cy.then(() =>
			websocketHelper.sendMessage(
				JSON.stringify({
					message: "This is a message for my user",
					userId: "my-user",
				}),
			),
		);

		cy.contains("This is a message for my user");
	});
});
