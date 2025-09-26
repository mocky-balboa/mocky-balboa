import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";

const createApolloClient = () => {
	return new ApolloClient({
		link: new HttpLink({
			uri: "https://this-is-not-a-real-endpoint.com/graphql",
		}),
		cache: new InMemoryCache(),
	});
};

export default createApolloClient;
