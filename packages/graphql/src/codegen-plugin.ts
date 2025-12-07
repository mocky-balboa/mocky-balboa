import type { CodegenPlugin } from "@graphql-codegen/plugin-helpers";
import type { LoadedFragment } from "@graphql-codegen/visitor-plugin-common";
import {
	concatAST,
	type DocumentNode,
	type FragmentDefinitionNode,
	Kind,
	visit,
} from "graphql";
import { MockyBalboaVisitor } from "./visitor.js";

const isDocumentNode = (document: unknown): document is DocumentNode => {
	return (
		document !== undefined &&
		document !== null &&
		typeof document === "object" &&
		"kind" in document &&
		document.kind === Kind.DOCUMENT
	);
};

/**
 * GraphQL Codegen plugin for Mocky Balboa to generate mock functions for mocking
 * GraphQL operations using the Mocky Balboa client.
 */
const plugin: CodegenPlugin["plugin"] = (schema, documents, config) => {
	const allDocuments = concatAST(
		documents.map((v) => v.document).filter(isDocumentNode),
	);
	const allFragments: LoadedFragment[] = (
		allDocuments.definitions.filter(
			(d) => d.kind === Kind.FRAGMENT_DEFINITION,
		) as FragmentDefinitionNode[]
	).map((fragmentDef) => ({
		node: fragmentDef,
		name: fragmentDef.name.value,
		onType: fragmentDef.typeCondition.name.value,
		isExternal: false,
	}));

	const visitor = new MockyBalboaVisitor(schema, allFragments, config, {});
	visit(allDocuments, visitor);

	return {
		prepend: visitor.getImports(),
		content: visitor.getContent(),
	};
};

const pluginExport = {
	plugin,
};

export default pluginExport;
export { plugin };
