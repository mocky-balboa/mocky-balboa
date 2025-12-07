import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
	schema: "src/graphql/schema.graphql",
	generates: {
		"src/graphql/generated.ts": {
			documents: "src/graphql/operations/**/*.ts",
			plugins: ["typescript", "typescript-operations", "typed-document-node"],
		},
		"playwright-tests/graphql/generated.ts": {
			documents: "src/graphql/operations/**/*.ts",
			plugins: [
				"typescript",
				"typescript-operations",
				"@mocky-balboa/graphql/codegen-plugin",
			],
			config: {
				nonOptionalTypename: true,
			},
		},
	},
};

export default config;
