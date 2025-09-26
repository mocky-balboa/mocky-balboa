import { gql } from "@apollo/client";

export const USER_FRAGMENT = gql`
  fragment UserFragment on User {
    id
    username
    email
    isAdmin
    createdAt
    preferences {
      ...UserPreferencesFragment
    }
  }
`;

export const USER_PREFERENCES_FRAGMENT = gql`
  fragment UserPreferencesFragment on UserPreferences {
    theme
    notificationsEnabled
    language
  }
`;

export const POST_FRAGMENT = gql`
  fragment PostFragment on Post {
    id
    title
    content
    status
    tags
    publishedAt
    author {
      ...UserFragment
    }
  }
`;

export const POST_WITHOUT_AUTHOR_FRAGMENT = gql`
  fragment PostWithoutAuthorFragment on Post {
    id
    title
    content
    status
    tags
    publishedAt
  }
`;
