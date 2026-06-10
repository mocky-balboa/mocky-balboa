import { exec } from "node:child_process";
import path from "node:path";
import { rimraf } from "rimraf";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@mocky-balboa/graphql", () => {
	return import(path.resolve(packageRoot, "src/graphql.ts"));
});

const packageRoot = path.resolve(import.meta.dirname, "..");

afterAll(async () => {
	await rimraf(path.resolve(packageRoot, "src/test/generated"));
});

describe.each(["lower", "pascal", "snake", "sponge", "upper"] as const)(
	"Codegen Plugin using %s-case",
	(namingConvention) => {
		// biome-ignore lint/suspicious/noExplicitAny: Testing generated module
		let generatedModule: Record<string, any>;

		beforeAll(async () => {
			await rimraf(path.resolve(packageRoot, "src/test/generated"));
			await new Promise<void>((resolve, reject) => {
				exec(
					`pnpm graphql-codegen --config src/test/codegen-configs/${namingConvention}-case.ts`,
					{ cwd: packageRoot },
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

			generatedModule = await import(
				path.resolve(
					packageRoot,
					`src/test/generated/graphql-${namingConvention}.ts`,
				)
			);
		});

		const expectedOperations: Array<
			[string, "query" | "mutation" | "subscription"]
		> = [
			["GetUser", "query"],
			["get_posts", "query"],
			["SearchPostsWithDirectives", "query"],
			["CreateUser", "mutation"],
			["create_post", "mutation"],
			["LikePost", "mutation"],

			["GetUserProfile", "query"],
			["GetUserPosts", "query"],
			["UpdateUserProfile", "mutation"],
			["CreatePostAndLike", "mutation"],

			["GetCurrentUser", "query"],
			["GetUsersWithFilter", "query"],
			["DeleteUser", "mutation"],
			["UpdateUserPreferences", "mutation"],

			["GetPostWithComments", "query"],
			["GetPostAnalytics", "query"],
			["PublishPost", "mutation"],
			["UnpublishPost", "mutation"],
			["DeletePost", "mutation"],

			["GetComments", "query"],
			["GetComment", "query"],
			["CreateComment", "mutation"],
			["UpdateComment", "mutation"],
			["DeleteComment", "mutation"],
			["LikeComment", "mutation"],
			["UnlikeComment", "mutation"],

			["ComplexDirectivesQuery", "query"],
			["ComplexDirectivesMutation", "mutation"],

			["PostPublished", "subscription"],
			["CommentAdded", "subscription"],
		];

		it.each(expectedOperations)(
			"should export the %s operation as %s",
			(name, type) => {
				expect(generatedModule).toHaveProperty(name);
				const op = generatedModule[name];
				expect(op).toEqual({ name, type });
			},
		);

		it("should not export any unexpected operations", () => {
			const generatedNames = Object.keys(generatedModule)
				.filter((key) => {
					const value = generatedModule[key];
					return (
						value &&
						typeof value === "object" &&
						"name" in value &&
						"type" in value
					);
				})
				.sort();

			expect(generatedNames).toHaveLength(expectedOperations.length);

			expectedOperations.forEach(([expectedName]) => {
				expect(generatedNames).toContain(expectedName);
			});
		});

		it("emits the expected operation descriptors for subscriptions", () => {
			const postPublished = generatedModule.PostPublished;
			const commentAdded = generatedModule.CommentAdded;

			expect(postPublished).toEqual({
				name: "PostPublished",
				type: "subscription",
			});
			expect(commentAdded).toEqual({
				name: "CommentAdded",
				type: "subscription",
			});
		});
	},
);
