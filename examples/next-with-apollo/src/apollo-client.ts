import { ApolloLink, HttpLink } from "@apollo/client";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { ApolloClient, InMemoryCache } from "@apollo/client-integration-nextjs";
import { createClient } from "graphql-ws";

export const makeClient = () => {
	return new ApolloClient({
		cache: new InMemoryCache(),
		link: ApolloLink.split(
			(op) => op.operationType === "subscription",
			new GraphQLWsLink(
				createClient({
					url: "wss://this-is-not-a-real-endpoint.com/graphql-subscription",
				}),
			),
			new HttpLink({
				uri: "https://this-is-not-a-real-endpoint.com/graphql",
			}),
		),
	});
};
