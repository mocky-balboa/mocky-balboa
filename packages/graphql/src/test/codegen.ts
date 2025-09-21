import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
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

export default config;
