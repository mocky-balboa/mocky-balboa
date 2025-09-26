import { useMutation } from "@apollo/client/react";
import {
	DeleteUserDocument,
	type DeleteUserMutation,
	type DeleteUserMutationVariables,
} from "../generated/graphql";

export const useDeleteUser = (
	options: useMutation.Options<DeleteUserMutation, DeleteUserMutationVariables>,
) => {
	return useMutation(DeleteUserDocument, options);
};
