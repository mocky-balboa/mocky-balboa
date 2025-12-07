import { useMutation } from "@apollo/client/react";
import {
	PublishPostDocument,
	type PublishPostMutation,
	type PublishPostMutationVariables,
} from "../generated";

export const usePublishPost = (
	options: useMutation.Options<
		PublishPostMutation,
		PublishPostMutationVariables
	>,
) => {
	return useMutation(PublishPostDocument, options);
};
