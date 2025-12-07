import { gql } from "@apollo/client";

export const getCurrentUserQuery = gql`
  query getCurrentUser {
    getCurrentUser {
      id
      username
      email
      isAdmin
      preferences {
        theme
        notificationsEnabled
        language
      }
    }
  }
`;
