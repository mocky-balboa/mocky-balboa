import { gql } from "@apollo/client";
import { POST_FRAGMENT } from "./fragments";

export const createPostMutation = gql`
  mutation createPost($input: CreatePostInput!) {
    createPost(input: $input) {
      ...PostFragment
    }
  }
  ${POST_FRAGMENT}
`;
