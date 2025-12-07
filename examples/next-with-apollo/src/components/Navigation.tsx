"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useGetCurrentUser } from "@/graphql/hooks/useGetCurrentUser";

export default function Navigation() {
	const pathname = usePathname();
	const { data: currentUser } = useGetCurrentUser({});

	const navItems = [
		{ name: "Home", href: "/" },
		{ name: "Search Posts", href: "/search" },
		{ name: "Profile", href: "/profile" },
	];

	if (currentUser?.getCurrentUser?.isAdmin) {
		navItems.push({ name: "Admin", href: "/admin" });
	}

	return (
		<nav className="bg-gray-800 p-4 shadow-md">
			<div className="max-w-7xl mx-auto flex justify-between items-center">
				<Link href="/" className="text-white text-2xl font-bold">
					Mocky Balboa Blog
				</Link>
				<div className="flex space-x-4">
					{navItems.map((item) => (
						<Link
							key={item.name}
							href={item.href}
							className={`px-3 py-2 rounded-md text-sm font-medium ${
								pathname === item.href
									? "bg-gray-900 text-white"
									: "text-gray-300 hover:bg-gray-700 hover:text-white"
							}`}
						>
							{item.name}
						</Link>
					))}
				</div>
				{currentUser?.getCurrentUser && (
					<div className="text-right text-white">
						<p className="text-sm font-medium">
							{currentUser.getCurrentUser.username}
						</p>
						<p className="text-xs text-gray-400">
							{currentUser.getCurrentUser.isAdmin ? "Admin" : "User"}
						</p>
					</div>
				)}
			</div>
		</nav>
	);
}
