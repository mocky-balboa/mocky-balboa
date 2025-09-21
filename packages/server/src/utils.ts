import fs from "node:fs/promises";
import type { SelfSignedCertificate } from "@mocky-balboa/shared-config";

export const loadCertificateFiles = async (
	certificate: SelfSignedCertificate,
) => {
	const [cert, key, ca] = await Promise.all([
		fs.readFile(certificate.cert),
		fs.readFile(certificate.key),
		certificate.rootCA
			? fs.readFile(certificate.rootCA)
			: Promise.resolve(undefined),
	]);

	return { cert, key, ca };
};
