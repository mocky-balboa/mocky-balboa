import { getNextFight, getTrainingRegime } from "$lib/data";
import type { PageLoad } from "./$types";

export const ssr = false;

export const load: PageLoad = async () => {
	const [trainingRegimeResult, nextFightResult] = await Promise.allSettled([
		getTrainingRegime(),
		getNextFight(),
	]);

	const [trainingRegime, trainingRegimeError] =
		trainingRegimeResult.status === "fulfilled"
			? trainingRegimeResult.value
			: [null, trainingRegimeResult.reason as Error];

	const [nextFight, nextFightError] =
		nextFightResult.status === "fulfilled"
			? nextFightResult.value
			: [null, nextFightResult.reason as Error];

	return {
		trainingRegime,
		nextFight,
		trainingRegimeError,
		nextFightError,
	};
};
