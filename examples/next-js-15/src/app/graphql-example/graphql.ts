export const makeGraphQLRequest = async <TResponse>(
	query: string,
	operationName: string,
	variables: Record<string, unknown> = {},
): Promise<TResponse | null> => {
	try {
		const response = await fetch("http://localhost:9082/api/graphql", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				query,
				operationName,
				variables,
			}),
		});

		const responseJson = await response.json();
		if (!response.ok) {
			throw new Error(`GraphQL request failed with status ${response.status}`);
		}

		if (!responseJson.data || !responseJson.data[operationName]) {
			throw new Error(`GraphQL response is missing data`);
		}

		return responseJson.data[operationName] as TResponse;
	} catch (error) {
		console.error(error);
		return null;
	}
};
