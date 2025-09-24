import "./commands.js";

/**
 * Workaround for issue [27204](https://github.com/cypress-io/cypress/issues/27204)
 *
 * @see https://github.com/cypress-io/cypress/issues/27204
 * @see https://github.com/cypress-io/cypress/issues/27204#issuecomment-1646017452
 */
function onUncaughtException(err: Error) {
	if (
		err.message.includes("Minified React error #418") ||
		err.message.includes("Error: Minified React error #423")
	) {
		return false;
	}
}

Cypress.on("uncaught:exception", onUncaughtException);
