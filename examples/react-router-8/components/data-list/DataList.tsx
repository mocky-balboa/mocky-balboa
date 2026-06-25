import { Text } from "../text/Text";
import { Box } from "../box/Box";

export interface DataListProps {
  data: {
    id: string;
    label: string;
    value: React.ReactNode;
  }[];
}

export const DataList = ({ data }: DataListProps) => {
  return (
    <Box display="flex" flexDirection="column" gap="8px">
      {data.map((item) => (
        <Box key={item.id} justifyContent="space-between" display="flex">
          <Text fontWeight="bold">{item.label}</Text>
          <Box textAlign="right">{item.value}</Box>
        </Box>
      ))}
    </Box>
  );
};
