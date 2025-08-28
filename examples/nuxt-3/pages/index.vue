<script setup lang="ts">
import {
    getNextFight,
    getTrainingRegime,
    FightStatus,
    type Fight,
    type TrainingRegime,
    type CareerRecord,
    type Record,
} from "@/lib/data";
import Card from "primevue/card";
import DataCard from "@/components/data-card.vue";

const data: {
    nextFight: Fight | null;
    trainingRegime: TrainingRegime | null;
} = {
    nextFight: null,
    trainingRegime: null,
};

const errors: {
    nextFight: Error | null;
    trainingRegime: Error | null;
} = {
    nextFight: null,
    trainingRegime: null,
};

try {
    const [nextFightResult, trainingRegimeResult] = await Promise.allSettled([
        getNextFight(),
        getTrainingRegime(),
    ]);

    if (nextFightResult.status === "fulfilled") {
        data.nextFight = nextFightResult.value[0];
        errors.nextFight = nextFightResult.value[1];
    } else {
        errors.nextFight = nextFightResult.reason;
    }

    if (trainingRegimeResult.status === "fulfilled") {
        data.trainingRegime = trainingRegimeResult.value[0];
        errors.trainingRegime = trainingRegimeResult.value[1];
    } else {
        errors.trainingRegime = trainingRegimeResult.reason;
    }
} catch (error) {
    console.error(error);
}

const getRecord = (careerRecord: CareerRecord) => {
    const count = (record: Record) => {
        return `${careerRecord.wins.total} (${record.ko} KO)`;
    };
    return `${count(careerRecord.wins)} - ${count(careerRecord.losses)} - ${careerRecord.draws}`;
};

const getFightDisplayData = () => {
    if (!data.nextFight) return [];
    return [
        { id: "name", label: "Name", value: data.nextFight.opponent.name },
        {
            id: "record",
            label: "Record",
            value: getRecord(data.nextFight.opponent.record),
        },
        {
            id: "fight-date",
            label: "Next fight",
            value: new Date(data.nextFight.date).toLocaleDateString(),
        },
        { id: "status", label: "Status", value: data.nextFight.status },
    ];
};

const getTrainingDisplayData = () => {
    if (!data.trainingRegime) return [];
    return [
        ...Object.entries(data.trainingRegime.routine).map(
            ([label, value]) => ({
                id: label,
                label: label,
                value: value,
            }),
        ),
        {
            id: "intensity",
            label: "Intensity",
            value: data.trainingRegime.intensity,
        },
    ];
};
</script>

<template>
    <div class="p-8">
        <Card class="max-w-4xl mx-auto">
            <template #content>
                <h1 class="text-3xl mb-4 text-center">
                    <span class="font-bold">Mocky Balboa:</span>
                    The Italian Stallion's Training Log
                </h1>
                <p class="m-0 text-center">
                    Welcome to Mocky's corner! This page simulates data fetched
                    from a remote API on the server, ready for Mock-Balboa's
                    network request interception.
                </p>
                <div class="mt-6 flex gap-4">
                    <DataCard
                        :title="'Current opponent'"
                        :data="getFightDisplayData()"
                        :error="
                            errors.nextFight?.message
                                ? 'Failed to load next fight data'
                                : null
                        "
                    />
                    <DataCard
                        :title="'Daily Training Stats'"
                        :data="getTrainingDisplayData()"
                        :error="
                            errors.trainingRegime?.message
                                ? 'Failed to load training log data'
                                : null
                        "
                    />
                </div>
            </template>
        </Card>
    </div>
</template>
