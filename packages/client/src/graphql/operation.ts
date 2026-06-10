/**
 * Supported GraphQL operation types
 */
export type GraphQLOperationType = "query" | "mutation" | "subscription";

/**
 * Typed descriptor for a GraphQL operation. Carries the operation's name and type
 * at runtime, plus phantom variable and response types for type inference on
 * route handlers.
 *
 * @remarks
 * The `__types` phantom field exists only to carry generic type information
 * through `Operation` values — it is never populated at runtime.
 */
export interface Operation<
	TVariables,
	TResponse,
	TType extends GraphQLOperationType = GraphQLOperationType,
> {
	readonly name: string;
	readonly type: TType;
	readonly __types?: { variables: TVariables; response: TResponse };
}

/**
 * Construct a typed {@link Operation} descriptor.
 *
 * @remarks
 * The first call captures the variables and response types (which are not
 * inferable from the runtime arguments) and the second call records the
 * operation name and type. This two-step form preserves literal inference of
 * the operation type so transport-specific `route()` methods can reject
 * mismatched operations at compile time.
 *
 * @example
 * Declaring an operation by hand
 * ```ts
 * const GetUser = operation<{ id: string }, { user: User }>()("GetUser", "query");
 * ```
 *
 * @example
 * Typical usage — codegen output from `@mocky-balboa/graphql`
 * ```ts
 * // generated.ts
 * export const GetUser = operation<GetUserVariables, GetUserResult>()(
 *   "GetUser",
 *   "query",
 * );
 * ```
 */
export const operation =
	<TVariables, TResponse>() =>
	<TType extends GraphQLOperationType>(
		name: string,
		type: TType,
	): Operation<TVariables, TResponse, TType> => ({ name, type });

/**
 * Extract the variables type from an {@link Operation} type
 */
export type OperationVariables<TOperation> = TOperation extends Operation<
	infer V,
	// biome-ignore lint/suspicious/noExplicitAny: extracting one of two generics
	any,
	// biome-ignore lint/suspicious/noExplicitAny: extracting one of two generics
	any
>
	? V
	: never;

/**
 * Extract the response type from an {@link Operation} type
 */
export type OperationResponse<TOperation> = TOperation extends Operation<
	// biome-ignore lint/suspicious/noExplicitAny: extracting one of two generics
	any,
	infer R,
	// biome-ignore lint/suspicious/noExplicitAny: extracting one of two generics
	any
>
	? R
	: never;
