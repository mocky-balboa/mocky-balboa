import { useMutation } from "@apollo/client/react";
import {
	PublishPostDocument,
	type PublishPostMutation,
	type PublishPostMutationVariables,
} from "../generated/graphql";

export const usePublishPost = (
	options: useMutation.Options<
		PublishPostMutation,
		PublishPostMutationVariables
	>,
) => {
	return useMutation(PublishPostDocument, options);
};
