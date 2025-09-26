import { gql } from "@apollo/client";
import { USER_FRAGMENT } from "./fragments";

export const updateUserPreferencesMutation = gql`
  mutation updateUserPreferences($userId: ID!, $preferences: UpdateUserPreferencesInput!) {
    updateUserPreferences(userId: $userId, preferences: $preferences) {
      ...UserFragment
    }
  }
  ${USER_FRAGMENT}
`;
