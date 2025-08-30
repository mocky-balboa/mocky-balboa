import { Box } from "@/components/box/Box";
import { Card } from "@/components/card/Card";
import { Container } from "@/components/container/Container";
import { DataListError } from "@/components/data-list-error/DataListError";
import { DataList, DataListProps } from "@/components/data-list/DataList";
import { Text } from "@/components/text/Text";
import { Title } from "@/components/title/Title";
import {
  Fight,
  FightStatus,
  getNextFight,
  getTrainingRegime,
  TrainingRegime,
} from "@/lib/data";
import { makeGraphQLRequest } from "./graphql";
import {
  getProfileQuery,
  getUserSettingsQuery,
  type Profile,
  type UserSettings,
} from "@/lib/graphql";

export const dynamic = "force-dynamic";

export default async function GraphQLExample() {
  const [profileData, userSettingsData] = await Promise.all([
    makeGraphQLRequest<Profile>(getProfileQuery, "getProfile"),
    makeGraphQLRequest<UserSettings>(getUserSettingsQuery, "getUserSettings"),
  ]);

  return (
    <Container>
      <Box>
        <Title content={[{ text: "GraphQL Example" }]} />
        <Text>User Profile:</Text>
        {profileData && (
          <Card>
            <Text>ID: {profileData.user.id}</Text>
            <Text>Email: {profileData.user.email}</Text>
            <Text>Name: {profileData.user.name}</Text>
          </Card>
        )}
        {!profileData && (
          <Card>
            <Text>No profile data available</Text>
          </Card>
        )}
        <Text>User Settings:</Text>
        {userSettingsData && (
          <Card>
            <Text>
              Notifications Enabled:{" "}
              {userSettingsData.userSettings.notificationsEnabled
                ? "Yes"
                : "No"}
            </Text>
            <Text>
              Newsletter Subscription Enabled:{" "}
              {userSettingsData.userSettings.newsletterSubscriptionEnabled
                ? "Yes"
                : "No"}
            </Text>
          </Card>
        )}
        {!userSettingsData && (
          <Card>
            <Text>No user settings data available</Text>
          </Card>
        )}
      </Box>
    </Container>
  );
}
