import { useQuery } from "@apollo/client/react";
import {
	GetCurrentUserDocument,
	type GetCurrentUserQuery,
	type GetCurrentUserQueryVariables,
} from "../generated";

export const useGetCurrentUser = (
	options: useQuery.Options<GetCurrentUserQuery, GetCurrentUserQueryVariables>,
) => {
	return useQuery(GetCurrentUserDocument, options);
};
