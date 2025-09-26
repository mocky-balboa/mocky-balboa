import { useMutation } from "@apollo/client/react";
import {
	CreatePostDocument,
	type CreatePostMutation,
	type CreatePostMutationVariables,
} from "../generated/graphql";

export const useCreatePost = (
	options: useMutation.Options<CreatePostMutation, CreatePostMutationVariables>,
) => {
	return useMutation(CreatePostDocument, options);
};
