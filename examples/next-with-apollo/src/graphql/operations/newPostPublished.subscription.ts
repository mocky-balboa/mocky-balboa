import { gql } from "@apollo/client";
import { POST_FRAGMENT } from "./fragments";

export const newPostPublishedSubscription = gql`
  subscription newPostPublished($tags: [String!]) {
    newPostPublished(tags: $tags) {
      ...PostFragment
    }
  }
  ${POST_FRAGMENT}
`;
