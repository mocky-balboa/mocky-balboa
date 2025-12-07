it("updates the message in the UI when messages are received from the WebSocket server", () => {
	cy.mockyWebSocket(() => {
		return cy.visit("http://localhost:3000/websocket.html");
	}, "wss://somewhere.com:9898/websocket").then((websocketHelper) => {
		cy.then(() =>
			websocketHelper.onMessage((message) => {
				const parsedMessage = JSON.parse(message);
				if (parsedMessage.type !== "get_message") {
					throw new Error("Message not found");
				}

				websocketHelper.sendMessage(
					JSON.stringify({ message: "This is a message from the server" }),
				);
			}),
		);

		cy.get("#get-websocket-message").click();

		cy.contains("This is a message from the server");
	});
});
