import type { Client, ConnectOptions } from "@mocky-balboa/client";
import { test as base, type TestType } from "@playwright/test";
import { createClient } from "./playwright.js";

/**
 * Extended test properties
 */
export interface MockyPlaywrightTest {
	/**
	 * Connected instance of the client
	 */
	mocky: Client;
	/**
	 * Optional connection options for connecting to the Mocky Balboa server
	 */
	mockyConnectOptions: ConnectOptions;
}

// Type helpers for extracting generics from the TestType
type ExtractTestTypeGenerics<Type> = Type extends TestType<infer X, infer Y>
	? [X, Y]
	: never;
type ExtractTestArgs<Type> = ExtractTestTypeGenerics<Type> extends [
	infer X,
	infer _Y,
]
	? X
	: never;
type ExtractWorkerArgs<Type> = ExtractTestTypeGenerics<Type> extends [
	infer _X,
	infer Y,
]
	? Y
	: never;

/**
 * Extend a base test derived from Playwright's test object. This function
 * allows you to extend a custom test object by passing it as an argument.
 */
export const extendTest = <TBaseTest extends typeof base>(
	baseTest: TBaseTest,
	mockyConnectOptions?: ConnectOptions,
) =>
	baseTest.extend<MockyPlaywrightTest>({
		mockyConnectOptions: { ...mockyConnectOptions },
		mocky: async ({ context, mockyConnectOptions }, use) => {
			const mocky = await createClient(context, mockyConnectOptions);
			use(mocky);
		},
	}) as unknown as TestType<
		ExtractTestArgs<TBaseTest> & MockyPlaywrightTest,
		ExtractWorkerArgs<TBaseTest> & {}
	>;

/**
 * Extend the base playwright test with the mocky property
 */
const test = extendTest(base);

export default test;
