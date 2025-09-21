import {
	ClientSideBaseVisitor,
	type LoadedFragment,
	type RawClientSideBasePluginConfig,
} from "@graphql-codegen/visitor-plugin-common";
import {
	type ASTNode,
	type ASTVisitFn,
	type GraphQLSchema,
	Kind,
	type OperationDefinitionNode,
	type OperationTypeNode,
} from "graphql";
import { logger } from "./logger.js";

export class MockyBalboaVisitor extends ClientSideBaseVisitor {
	private operations: string[] = [];

	constructor(
		schema: GraphQLSchema,
		fragments: LoadedFragment[],
		rawConfig: RawClientSideBasePluginConfig,
	) {
		super(schema, fragments, rawConfig, {});
	}

	public getImports(): string[] {
		const hasOperations = this._collectedOperations.length > 0;

		if (!hasOperations) {
			return [];
		}

		return [
			`import { mockOperation, type HandlerOrFulfill, type MockOperationHandlerArg } from "@mocky-balboa/graphql"`,
		];
	}

	private isSupportedOperation(node: OperationTypeNode) {
		return node === "query" || node === "mutation";
	}

	private generateMockOperation(operation: OperationDefinitionNode): string {
		// Use the base visitor's convertName method to match TypeScript Operations plugin naming
		const operationName = this.convertName(operation.name?.value || "");
		const operationType = this.convertName(operation.operation);
		const fqn = `${operationName}${operationType}`;
		const responseFqn = fqn;
		const variablesFqn = `${fqn}Variables`;

		return `/**
 * Mock ${operation.name?.value} ${operation.operation}
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
export const mock${fqn} = (
  handler: HandlerOrFulfill<
    ${variablesFqn},
    ${responseFqn}
  >,
) => {
  return mockOperation<${variablesFqn}, ${responseFqn}>(
    handler as MockOperationHandlerArg<
      ${variablesFqn},
      ${responseFqn}
    >,
    {
      name: "${operation.name?.value}",
      type: "${operation.operation}",
    },
  );
};`;
	}

	getContent() {
		const mockOperations: string[] = [];
		for (const operation of this._collectedOperations) {
			mockOperations.push(this.generateMockOperation(operation));
		}

		return mockOperations.join("\n\n");
	}

	enter<TVisitedNode extends ASTNode>(
		...args: Parameters<ASTVisitFn<TVisitedNode>>
	) {
		const [node, _key, _parent, _path, _ancestors] = args;
		if (
			node.kind === Kind.OPERATION_DEFINITION &&
			this.isSupportedOperation(node.operation) &&
			node.name
		) {
			const operationNamespace = `${node.operation} ${node.name.value}`;
			if (this.operations.includes(operationNamespace)) {
				logger.warn(`Skipping duplicate operation: ${operationNamespace}`);
				return;
			}

			this._collectedOperations.push(node);
			this.operations.push(operationNamespace);
		}
	}
}
