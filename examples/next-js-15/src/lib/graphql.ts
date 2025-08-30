export const getProfileQuery = `
  query getProfile {
    user {
      id
      email
      name
    }
  }
`;

export const getUserSettingsQuery = `
  query getUserSettings {
    userSettings {
      notificationsEnabled
      newsletterSubscriptionEnabled
    }
  }
`;

export interface Profile {
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export interface UserSettings {
  userSettings: {
    notificationsEnabled: boolean;
    newsletterSubscriptionEnabled: boolean;
  };
}
