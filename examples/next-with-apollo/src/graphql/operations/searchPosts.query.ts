import { gql } from "@apollo/client";
import { POST_FRAGMENT } from "./fragments";

export const searchPostsQuery = gql`
  query searchPosts($filter: PostFilter!) {
    searchPosts(filter: $filter) {
      ...PostFragment
    }
  }
  ${POST_FRAGMENT}
`;
