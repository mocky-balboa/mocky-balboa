import { gql } from "@apollo/client";

export const deletePostMutation = gql`
  mutation deletePost($postId: ID!) {
    deletePost(postId: $postId)
  }
`;
