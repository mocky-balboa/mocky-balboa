"use client";

import { ApolloNextAppProvider } from "@apollo/client-integration-nextjs";
import { makeClient } from "@/apollo-client";

export default function ApolloWrapper({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<ApolloNextAppProvider makeClient={makeClient}>
			{children}
		</ApolloNextAppProvider>
	);
}
