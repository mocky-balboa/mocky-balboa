import { useMutation } from "@apollo/client/react";
import {
	DeletePostDocument,
	type DeletePostMutation,
	type DeletePostMutationVariables,
} from "../generated";

export const useDeletePost = (
	options: useMutation.Options<DeletePostMutation, DeletePostMutationVariables>,
) => {
	return useMutation(DeletePostDocument, options);
};
