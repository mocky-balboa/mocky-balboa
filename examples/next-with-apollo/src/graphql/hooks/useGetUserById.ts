import { useQuery } from "@apollo/client/react";
import {
	GetUserByIdDocument,
	type GetUserByIdQuery,
	type GetUserByIdQueryVariables,
} from "../generated";

export const useGetUserById = (
	options: useQuery.Options<GetUserByIdQuery, GetUserByIdQueryVariables>,
) => {
	return useQuery(GetUserByIdDocument, options);
};
