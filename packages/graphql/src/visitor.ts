import { ClientSideBaseVisitor } from "@graphql-codegen/visitor-plugin-common";
import { titleCase } from "change-case-all";
import type { OperationDefinitionNode } from "graphql";

export class MockyBalboaVisitor extends ClientSideBaseVisitor {
	private mockFunctions: string[] = [];

	public getImports(): string[] {
		const hasOperations = this._collectedOperations.length > 0;

		if (!hasOperations) {
			return [];
		}

		return [
			`import { mockOperation, type HandlerOrFulfill, type MockOperationHandlerArg } from "@mocky-balboa/graphql"`,
		];
	}

	private isSupportedOperation(node: OperationDefinitionNode) {
		return node.operation === "query" || node.operation === "mutation";
	}

	getContent() {
		return this.mockFunctions.join("\n\n");
	}

	protected buildOperation(
		node: OperationDefinitionNode,
		_documentVariableName: string,
		operationType: string,
		operationResultType: string,
		operationVariablesTypes: string,
		_hasRequiredVariables: boolean,
	): string {
		if (!this.isSupportedOperation(node)) return "";
		const mockFunction = `/**
 * Mock ${node.name?.value} ${operationType}
 *
 * @example
 * Mocking fulfilled responses with objects
 * \`\`\`TypeScript
 * graphql.route({ data: { ... } })
 * \`\`\`
 * 
 * @example
 * Mocking responses with a handler function and access to GraphQL route helper
 * \`\`\`TypeScript
 * graphql.route((route) => {
 *   return route.fulfill({ ... });
 * })
 * \`\`\`
 */
export const mock${titleCase(node.name?.value ?? "")}${titleCase(operationType)} = (
  handler: HandlerOrFulfill<
    ${operationVariablesTypes},
    ${operationResultType}
  >,
) => {
  return mockOperation<${operationVariablesTypes}, ${operationResultType}>(
    handler as MockOperationHandlerArg<
      ${operationVariablesTypes},
      ${operationResultType}
    >,
    {
      name: "${node.name?.value}",
      type: "${node.operation}",
    },
  );
};`;

		this.mockFunctions.push(mockFunction);
		return mockFunction;
	}
}
