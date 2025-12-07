import { gql } from "@apollo/client";
import { POST_WITHOUT_AUTHOR_FRAGMENT, USER_FRAGMENT } from "./fragments";

export const getUserByIdQuery = gql`
  query getUserById($id: ID!) {
    getUserById(id: $id) {
      ...UserFragment
      posts(limit: 5) {
        ...PostWithoutAuthorFragment
      }
    }
  }
  ${USER_FRAGMENT}
  ${POST_WITHOUT_AUTHOR_FRAGMENT}
`;
