import { config } from "./codegen-configs/base-config.js";

export const updateNamingConvention = (namingConvention: string) => {
	const generatesKey = Object.keys(config.generates)[0];
	if (!generatesKey) {
		throw new Error("No generates key found in config");
	}

	const generates =
		config.generates[generatesKey as keyof typeof config.generates];
	return {
		...config,
		generates: {
			[generatesKey.replace(/\.ts$/, `-${namingConvention}.ts`)]: {
				...generates,
				config: {
					namingConvention: `change-case-all#${namingConvention}Case`,
				},
			},
		},
	};
};
