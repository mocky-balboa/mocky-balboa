import { gql } from "@apollo/client";
import { USER_FRAGMENT } from "./fragments";

export const getUsersWithFilterQuery = gql`
  query getUsersWithFilter($limit: Int!, $offset: Int!, $isAdmin: Boolean) {
    getUsersWithFilter(limit: $limit, offset: $offset, isAdmin: $isAdmin) {
      ...UserFragment
    }
  }
  ${USER_FRAGMENT}
`;
