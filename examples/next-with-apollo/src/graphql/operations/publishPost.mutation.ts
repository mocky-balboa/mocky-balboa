import { gql } from "@apollo/client";
import { POST_FRAGMENT } from "./fragments";

export const publishPostMutation = gql`
  mutation publishPost($postId: ID!) {
    publishPost(postId: $postId) {
      ...PostFragment
    }
  }
  ${POST_FRAGMENT}
`;
