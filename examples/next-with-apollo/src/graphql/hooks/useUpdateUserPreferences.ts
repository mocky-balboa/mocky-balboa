import { useMutation } from "@apollo/client/react";
import {
	UpdateUserPreferencesDocument,
	type UpdateUserPreferencesMutation,
	type UpdateUserPreferencesMutationVariables,
} from "../generated";

export const useUpdateUserPreferences = (
	options: useMutation.Options<
		UpdateUserPreferencesMutation,
		UpdateUserPreferencesMutationVariables
	>,
) => {
	return useMutation(UpdateUserPreferencesDocument, options);
};
