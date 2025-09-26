import { useSubscription } from "@apollo/client/react";
import {
	UserStatusUpdatedDocument,
	type UserStatusUpdatedSubscription,
	type UserStatusUpdatedSubscriptionVariables,
} from "../generated/graphql";

export const useUserStatusUpdated = (
	options: useSubscription.Options<
		UserStatusUpdatedSubscription,
		UserStatusUpdatedSubscriptionVariables
	>,
) => {
	return useSubscription(UserStatusUpdatedDocument, options);
};
