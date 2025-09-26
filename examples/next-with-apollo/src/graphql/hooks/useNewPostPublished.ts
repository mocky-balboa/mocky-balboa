import { useSubscription } from "@apollo/client/react";
import {
	NewPostPublishedDocument,
	type NewPostPublishedSubscription,
	type NewPostPublishedSubscriptionVariables,
} from "../generated";

export const useNewPostPublished = (
	options: useSubscription.Options<
		NewPostPublishedSubscription,
		NewPostPublishedSubscriptionVariables
	>,
) => {
	return useSubscription(NewPostPublishedDocument, options);
};
