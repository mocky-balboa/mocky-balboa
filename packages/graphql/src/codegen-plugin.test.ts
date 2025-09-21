import { exec } from "node:child_process";
import path from "node:path";
import { rimraf } from "rimraf";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@mocky-balboa/graphql", () => {
	return import(path.resolve(packageRoot, "src/graphql.ts"));
});

const packageRoot = path.resolve(import.meta.dirname, "..");

describe("Codegen Plugin", () => {
	// biome-ignore lint/suspicious/noExplicitAny: Testing generated module
	let generatedModule: Record<string, any>;

	beforeAll(async () => {
		// Clean and regenerate the GraphQL types
		await rimraf(path.resolve(packageRoot, "src/test/generated"));
		await new Promise<void>((resolve, reject) => {
			exec(
				"pnpm graphql-codegen --config src/test/codegen.ts",
				{
					cwd: packageRoot,
				},
				(error, stdout, stderr) => {
					if (error) {
						console.error("Codegen error:", error);
						console.error("Stdout:", stdout);
						console.error("Stderr:", stderr);
						reject(error);
					} else {
						resolve();
					}
				},
			);
		});

		// Load the generated module
		generatedModule = await import(
			path.resolve(packageRoot, "src/test/generated/graphql.ts")
		);
	});

	describe("Mock Function Exports", () => {
		const expectedMockFunctions = [
			// Single operations
			"mockGetUserQuery",
			"mockGet_PostsQuery",
			"mockSearchPostsWithDirectivesQuery",
			"mockCreateUserMutation",
			"mockCreate_PostMutation",
			"mockLikePostMutation",

			// Multiple operations from multipleOperations.graphql
			"mockGetUserProfileQuery",
			"mockGetUserPostsQuery",
			"mockUpdateUserProfileMutation",
			"mockCreatePostAndLikeMutation",

			// User management operations
			"mockGetCurrentUserQuery",
			"mockGetUsersWithFilterQuery",
			"mockDeleteUserMutation",
			"mockUpdateUserPreferencesMutation",

			// Post operations
			"mockGetPostWithCommentsQuery",
			"mockGetPostAnalyticsQuery",
			"mockPublishPostMutation",
			"mockUnpublishPostMutation",
			"mockDeletePostMutation",

			// Comment operations
			"mockGetCommentsQuery",
			"mockGetCommentQuery",
			"mockCreateCommentMutation",
			"mockUpdateCommentMutation",
			"mockDeleteCommentMutation",
			"mockLikeCommentMutation",
			"mockUnlikeCommentMutation",

			// Complex directives
			"mockComplexDirectivesQueryQuery",
			"mockComplexDirectivesMutationMutation",
		] as const;

		it("should export all expected mock functions", () => {
			expectedMockFunctions.forEach((mockFunctionName) => {
				expect(generatedModule).toHaveProperty(mockFunctionName);
				expect(typeof generatedModule[mockFunctionName]).toBe("function");
			});
		});

		it("should not have any extra mock functions beyond the expected ones", () => {
			const actualMockFunctions = Object.keys(generatedModule)
				.filter((key) => key.startsWith("mock"))
				.sort();

			// Check that we have exactly the expected number of mock functions
			expect(actualMockFunctions).toHaveLength(expectedMockFunctions.length);

			// Check that all actual mock functions are in the expected list
			actualMockFunctions.forEach((mockFunctionName) => {
				expect(expectedMockFunctions).toContain(mockFunctionName);
			});

			// Check that all expected mock functions are present
			expectedMockFunctions.forEach((expectedMockFunction) => {
				expect(actualMockFunctions).toContain(expectedMockFunction);
			});
		});
	});

	describe("Mock Function Behavior", () => {
		it("should create mock functions that return proper operation metadata", () => {
			const mockGetUser = generatedModule.mockGetUserQuery;
			const mockCreateUser = generatedModule.mockCreateUserMutation;
			const mockGetPosts = generatedModule.mockGet_PostsQuery;
			const mockCreatePost = generatedModule.mockCreate_PostMutation;

			// Test with a simple handler function
			const handler = () => ({
				type: "fulfill" as const,
				response: new Response(),
			});

			const getUserResult = mockGetUser(handler);
			const createUserResult = mockCreateUser(handler);
			const getPostsResult = mockGetPosts(handler);
			const createPostResult = mockCreatePost(handler);

			// Verify the mock functions return objects with expected structure
			expect(getUserResult).toBeDefined();
			expect(createUserResult).toBeDefined();
			expect(getPostsResult).toBeDefined();
			expect(createPostResult).toBeDefined();

			// Check operation names
			expect(getUserResult.operationName).toBe("GetUser");
			expect(createUserResult.operationName).toBe("CreateUser");
			expect(getPostsResult.operationName).toBe("get_posts");
			expect(createPostResult.operationName).toBe("create_post");

			// Check operation types
			expect(getUserResult.operationType).toBe("query");
			expect(createUserResult.operationType).toBe("mutation");
			expect(getPostsResult.operationType).toBe("query");
			expect(createPostResult.operationType).toBe("mutation");

			// Check handlers are functions
			expect(typeof getUserResult.handler).toBe("function");
			expect(typeof createUserResult.handler).toBe("function");
			expect(typeof getPostsResult.handler).toBe("function");
			expect(typeof createPostResult.handler).toBe("function");
		});

		it("should handle both camelCase and snake_case operation names correctly", () => {
			const mockGetUser = generatedModule.mockGetUserQuery;
			const mockGetPosts = generatedModule.mockGet_PostsQuery;
			const mockCreateUser = generatedModule.mockCreateUserMutation;
			const mockCreatePost = generatedModule.mockCreate_PostMutation;

			const handler = () => ({
				type: "fulfill" as const,
				response: new Response(),
			});

			// These should not throw and should return valid objects
			expect(() => mockGetUser(handler)).not.toThrow();
			expect(() => mockGetPosts(handler)).not.toThrow();
			expect(() => mockCreateUser(handler)).not.toThrow();
			expect(() => mockCreatePost(handler)).not.toThrow();
		});

		it("should handle operations with directives correctly", () => {
			const mockComplexQuery = generatedModule.mockComplexDirectivesQueryQuery;
			const mockComplexMutation =
				generatedModule.mockComplexDirectivesMutationMutation;

			const handler = () => ({
				type: "fulfill" as const,
				response: new Response(),
			});

			expect(() => mockComplexQuery(handler)).not.toThrow();
			expect(() => mockComplexMutation(handler)).not.toThrow();
		});

		it("should handle operations with complex variable types", () => {
			const mockComplexQuery = generatedModule.mockComplexDirectivesQueryQuery;
			const mockComplexMutation =
				generatedModule.mockComplexDirectivesMutationMutation;

			const handler = () => ({
				type: "fulfill" as const,
				response: new Response(),
			});

			// Test with complex variable types
			expect(() => mockComplexQuery(handler)).not.toThrow();
			expect(() => mockComplexMutation(handler)).not.toThrow();
		});

		it("should handle operations with optional variables", () => {
			const mockGetPosts = generatedModule.mockGet_PostsQuery;
			const handler = () => ({
				type: "fulfill" as const,
				response: new Response(),
			});

			// Should handle optional variables
			expect(() => mockGetPosts(handler)).not.toThrow();
		});

		it("should handle operations with default values", () => {
			const mockSearchPosts =
				generatedModule.mockSearchPostsWithDirectivesQuery;
			const handler = () => ({
				type: "fulfill" as const,
				response: new Response(),
			});

			// Should handle default values in variables
			expect(() => mockSearchPosts(handler)).not.toThrow();
		});
	});
});
