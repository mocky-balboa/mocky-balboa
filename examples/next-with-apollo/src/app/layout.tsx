import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ApolloWrapper from "@/components/ApolloWrapper";
import Navigation from "@/components/Navigation";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Mocky Balboa Blog",
	description:
		"A blog application showcasing GraphQL operations with real-time features",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<ApolloWrapper>
			<html lang="en">
				<body
					className={`${geistSans.variable} ${geistMono.variable} antialiased`}
				>
					<Navigation />
					{children}
				</body>
			</html>
		</ApolloWrapper>
	);
}
