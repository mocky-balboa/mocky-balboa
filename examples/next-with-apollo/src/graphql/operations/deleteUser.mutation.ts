import { gql } from "@apollo/client";

export const deleteUserMutation = gql`
  mutation deleteUser($userId: ID!) {
    deleteUser(userId: $userId)
  }
`;
