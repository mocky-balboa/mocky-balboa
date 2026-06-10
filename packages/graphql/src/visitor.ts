import { ClientSideBaseVisitor } from "@graphql-codegen/visitor-plugin-common";
import type { OperationDefinitionNode } from "graphql";

export class MockyBalboaVisitor extends ClientSideBaseVisitor {
	private operations: string[] = [];

	public getImports(): string[] {
		if (this._collectedOperations.length === 0) {
			return [];
		}

		return [`import { operation } from "@mocky-balboa/graphql"`];
	}

	getContent() {
		return this.operations.join("\n\n");
	}

	protected buildOperation(
		node: OperationDefinitionNode,
		_documentVariableName: string,
		operationType: string,
		operationResultType: string,
		operationVariablesTypes: string,
		_hasRequiredVariables: boolean,
	): string {
		const name = node.name?.value;
		if (!name) return "";

		const declaration = `/**
 * Typed descriptor for the \`${name}\` ${operationType} operation.
 *
 * @example
 * Mocking a fulfilled response
 * \`\`\`TypeScript
 * graphql.route(${name}, { data: { ... } });
 * \`\`\`
 *
 * @example
 * Using a handler function
 * \`\`\`TypeScript
 * graphql.route(${name}, (route) => route.fulfill({ data: { ... } }));
 * \`\`\`
 */
export const ${name} = operation<
  ${operationVariablesTypes},
  ${operationResultType}
>()("${name}", "${node.operation}");`;

		this.operations.push(declaration);
		return declaration;
	}
}
