export interface Record {
  total: number;
  ko: number;
}

export interface CareerRecord {
  wins: Record;
  losses: Record;
  draws: number;
}

export enum FightStatus {
  UPCOMING = "UPCOMING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
}

export interface Fight {
  id: string;
  date: string;
  status: FightStatus;
  opponent: Opponent;
}

export interface Opponent {
  id: string;
  record: CareerRecord;
  name: string;
}

export enum TrainingIntensity {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
}

export interface TrainingRegime {
  id: string;
  name: string;
  intensity: TrainingIntensity;
  routine: {
    [key: string]: string;
  };
}

export type ApiResponse<T> = [T, null] | [null, Error];

export const getTrainingRegime = async (): Promise<
  ApiResponse<TrainingRegime>
> => {
  try {
    const response = await fetch("http://localhost:58157/api/training-regime");
    const data = await response.json();
    return [data, null];
  } catch (error) {
    console.error(error);
    return [null, error as Error];
  }
};

export const getNextFight = async (): Promise<ApiResponse<Fight>> => {
  try {
    const response = await fetch("http://localhost:58157/api/next-fight", {
      headers: {
        "X-Public-Api-Key": "public-api-key",
      },
    });
    const data = await response.json();
    return [data, null];
  } catch (error) {
    console.error(error);
    return [null, error as Error];
  }
};
