import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
	schema: "src/graphql/schema.graphql",
	generates: {
		"src/graphql/generated/": {
			documents: "src/graphql/operations/**/*.ts",
			preset: "client",
		},
	},
};

export default config;
