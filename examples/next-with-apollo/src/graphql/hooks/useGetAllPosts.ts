import { useQuery } from "@apollo/client/react";
import {
	GetAllPostsDocument,
	type GetAllPostsQuery,
	type GetAllPostsQueryVariables,
} from "../generated/graphql";

export const useGetAllPosts = (
	options: useQuery.Options<GetAllPostsQuery, GetAllPostsQueryVariables>,
) => {
	return useQuery(GetAllPostsDocument, options);
};
