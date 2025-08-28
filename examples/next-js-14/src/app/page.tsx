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

export default async function Home() {
  const [[nextFight, nextFightError], [trainingRegime, trainingRegimeError]] =
    await Promise.all([getNextFight(), getTrainingRegime()]);

  const getNextFightStats = (nextFight: Fight): DataListProps["data"] => {
    return [
      {
        id: "name",
        label: "Name",
        value: <Text>{nextFight.opponent.name}</Text>,
      },
      {
        id: "record",
        label: "Record",
        value: (
          <Text>
            {nextFight.opponent.record.wins.total} Wins (
            {nextFight.opponent.record.wins.ko} KO),{" "}
            {nextFight.opponent.record.losses.total} Losses (
            {nextFight.opponent.record.losses.ko} KO)
            {nextFight.opponent.record.draws > 0
              ? `, ${nextFight.opponent.record.draws} Draws`
              : ""}
          </Text>
        ),
      },
      {
        id: "next-fight-date",
        label: "Next Fight",
        value: <Text>{new Date(nextFight.date).toLocaleDateString()}</Text>,
      },
      {
        id: "status",
        label: "Status",
        value: (
          <>
            {nextFight.status === FightStatus.COMPLETED && (
              <Text color="green">Completed</Text>
            )}
            {nextFight.status === FightStatus.IN_PROGRESS && (
              <Text color="yellow">In Progress</Text>
            )}
            {nextFight.status === FightStatus.UPCOMING && (
              <Text color="blue">Upcoming</Text>
            )}
          </>
        ),
      },
    ];
  };

  const getTrainingStats = (
    trainingRegime: TrainingRegime,
  ): DataListProps["data"] => {
    return [
      ...Object.entries(trainingRegime.routine).map(([label, value]) => ({
        id: `${trainingRegime.id}-routine-${label}`,
        label,
        value: <Text>{value}</Text>,
      })),
      {
        id: "intensity",
        label: "Intensity",
        value: <Text color="purple">{trainingRegime.intensity}</Text>,
      },
    ];
  };

  return (
    <Container>
      <Title
        content={[
          { text: "Mocky Balboa", highlight: true },
          { text: ": The Italian Stallion's Training Log" },
        ]}
      ></Title>
      <Box margin="24px 0">
        <Text textAlign="center">
          Welcome to Mocky's corner! This page simulates data fetched from a
          remote API on the server, ready for Mock-Balboa's network request
          interception.
        </Text>
      </Box>
      <Box display="flex" gap="24px">
        <Card type={nextFightError ? "danger" : "primary"}>
          {!nextFightError ? (
            <>
              <Box marginBottom="16px">
                <Text textAlign="center">Current opponent</Text>
              </Box>
              <DataList data={getNextFightStats(nextFight)} />
            </>
          ) : (
            <DataListError message="Failed to load next fight data" />
          )}
        </Card>
        <Card type={trainingRegimeError ? "danger" : "primary"}>
          {!trainingRegimeError ? (
            <>
              <Box marginBottom="16px">
                <Text textAlign="center">Daily Training Stats</Text>
              </Box>
              <DataList data={getTrainingStats(trainingRegime)} />
            </>
          ) : (
            <DataListError message="Failed to load training log data" />
          )}
        </Card>
      </Box>
    </Container>
  );
}
