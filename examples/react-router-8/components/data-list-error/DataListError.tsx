import { Text } from "../text/Text";
import { Box } from "../box/Box";

export interface DataListErrorProps {
  message: string;
}

export const DataListError = ({ message }: DataListErrorProps) => {
  return (
    <Box display="flex" flexDirection="column" gap="8px" padding="16px 0">
      <Text textAlign="center" color="#5c0000">
        {message}
      </Text>
    </Box>
  );
};
