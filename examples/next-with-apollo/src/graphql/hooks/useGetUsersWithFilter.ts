import { useQuery } from "@apollo/client/react";
import {
	GetUsersWithFilterDocument,
	type GetUsersWithFilterQuery,
	type GetUsersWithFilterQueryVariables,
} from "../generated";

export const useGetUsersWithFilter = (
	options: useQuery.Options<
		GetUsersWithFilterQuery,
		GetUsersWithFilterQueryVariables
	>,
) => {
	return useQuery(GetUsersWithFilterDocument, options);
};
