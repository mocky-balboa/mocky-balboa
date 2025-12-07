import { gql } from "@apollo/client";
import { POST_FRAGMENT } from "./fragments";

export const getAllPostsQuery = gql`
  query getAllPosts {
    getAllPosts {
      ...PostFragment
    }
  }
  ${POST_FRAGMENT}
`;
