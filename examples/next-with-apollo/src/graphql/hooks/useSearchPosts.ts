import { useQuery } from "@apollo/client/react";
import {
	SearchPostsDocument,
	type SearchPostsQuery,
	type SearchPostsQueryVariables,
} from "../generated/graphql";

export const useSearchPosts = (
	options: useQuery.Options<SearchPostsQuery, SearchPostsQueryVariables>,
) => {
	return useQuery(SearchPostsDocument, options);
};
