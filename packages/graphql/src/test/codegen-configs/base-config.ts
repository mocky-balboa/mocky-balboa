export const config = {
	schema: "./src/test/schema.graphql",
	documents: ["src/test/documents/*.graphql"],
	generates: {
		"./src/test/generated/graphql.ts": {
			plugins: [
				"typescript",
				"typescript-operations",
				"@mocky-balboa/graphql/codegen-plugin",
			],
		},
	},
};
