import { gql } from "@apollo/client";
import { USER_FRAGMENT } from "./fragments";

export const userStatusUpdatedSubscription = gql`
  subscription userStatusUpdated($userId: ID!) {
    userStatusUpdated(userId: $userId) {
      ...UserFragment
    }
  }
  ${USER_FRAGMENT}
`;
