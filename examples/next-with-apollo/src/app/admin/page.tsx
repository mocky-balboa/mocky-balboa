"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { useDeleteUser } from "@/graphql/hooks/useDeleteUser";
import { useGetCurrentUser } from "@/graphql/hooks/useGetCurrentUser";
import { useGetUsersWithFilter } from "@/graphql/hooks/useGetUsersWithFilter";
import { useUserStatusUpdated } from "@/graphql/hooks/useUserStatusUpdated";

export default function AdminPage() {
	const [limit, setLimit] = useState(10);
	const [offset, setOffset] = useState(0);
	const [adminFilter, setAdminFilter] = useState<boolean | undefined>(
		undefined,
	);

	const limitId = useId();
	const filterId = useId();

	const { data: currentUser, loading: userLoading } = useGetCurrentUser({});
	const {
		data: usersData,
		loading: usersLoading,
		refetch,
	} = useGetUsersWithFilter({
		variables: {
			limit,
			offset,
			isAdmin: adminFilter,
		},
	});

	const [deleteUser] = useDeleteUser({
		onCompleted: () => refetch(),
	});

	// Real-time subscription for user status updates
	useUserStatusUpdated({
		variables: { userId: currentUser?.getCurrentUser?.id || "" },
		onData: ({ data }) => {
			if (data?.data?.userStatusUpdated) {
				refetch();
			}
		},
	});

	const handleDeleteUser = (userId: string, username: string) => {
		if (
			confirm(
				`Are you sure you want to delete user "${username}"? This action cannot be undone.`,
			)
		) {
			deleteUser({ variables: { userId } });
		}
	};

	const handleFilterChange = (newFilter: boolean | undefined) => {
		setAdminFilter(newFilter);
		setOffset(0);
	};

	const handlePageChange = (newOffset: number) => {
		setOffset(newOffset);
	};

	if (userLoading || usersLoading) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
					<p className="mt-4 text-gray-600">Loading...</p>
				</div>
			</div>
		);
	}

	if (!currentUser?.getCurrentUser?.isAdmin) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<div className="text-center">
					<h1 className="text-2xl font-bold text-gray-900 mb-4">
						Access Denied
					</h1>
					<p className="text-gray-600 mb-6">
						You need administrator privileges to access this page.
					</p>
					<Link
						href="/"
						className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
					>
						Go Home
					</Link>
				</div>
			</div>
		);
	}

	const users = usersData?.getUsersWithFilter || [];
	const hasNextPage = users.length === limit;
	const hasPrevPage = offset > 0;

	return (
		<div className="min-h-screen bg-gray-50">
			{/* Header */}
			<header className="bg-white shadow-sm border-b">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
					<div className="flex items-center justify-between">
						<div>
							<h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
							<p className="text-gray-600 mt-1">
								Manage users and system settings
							</p>
						</div>
						<Link
							href="/"
							className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
						>
							Back to Home
						</Link>
					</div>
				</div>
			</header>

			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				{/* Filters and Controls */}
				<div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
					<h2 className="text-xl font-semibold mb-4">User Filters</h2>
					<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
						<div>
							<label
								htmlFor={limitId}
								className="block text-sm font-medium text-gray-700 mb-1"
							>
								Results per page
							</label>
							<select
								id={limitId}
								value={limit}
								onChange={(e) => {
									setLimit(Number(e.target.value));
									setOffset(0);
								}}
								className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							>
								<option value={5}>5</option>
								<option value={10}>10</option>
								<option value={20}>20</option>
								<option value={50}>50</option>
							</select>
						</div>
						<div>
							<label
								htmlFor={filterId}
								className="block text-sm font-medium text-gray-700 mb-1"
							>
								User Type
							</label>
							<select
								id={filterId}
								value={adminFilter === undefined ? "" : adminFilter.toString()}
								onChange={(e) => {
									const value = e.target.value;
									handleFilterChange(
										value === "" ? undefined : value === "true",
									);
								}}
								className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							>
								<option value="">All Users</option>
								<option value="true">Admins Only</option>
								<option value="false">Regular Users Only</option>
							</select>
						</div>
						<div className="flex items-end">
							<button
								type="button"
								onClick={() => refetch()}
								className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
							>
								Refresh
							</button>
						</div>
						<div className="flex items-end">
							<button
								type="button"
								onClick={() => {
									setOffset(0);
									setAdminFilter(undefined);
								}}
								className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors"
							>
								Clear Filters
							</button>
						</div>
					</div>
				</div>

				{/* Users Table */}
				<div className="bg-white rounded-lg shadow-sm border">
					<div className="px-6 py-4 border-b border-gray-200">
						<h2 className="text-xl font-semibold">Users</h2>
					</div>

					{users.length === 0 ? (
						<div className="text-center py-12">
							<div className="text-gray-400 text-6xl mb-4">👥</div>
							<h3 className="text-lg font-medium text-gray-900 mb-2">
								No users found
							</h3>
							<p className="text-gray-500">Try adjusting your filters</p>
						</div>
					) : (
						<>
							<div className="overflow-x-auto">
								<table className="min-w-full divide-y divide-gray-200">
									<thead className="bg-gray-50">
										<tr>
											<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
												User
											</th>
											<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
												Email
											</th>
											<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
												Role
											</th>
											<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
												Created
											</th>
											<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
												Posts
											</th>
											<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
												Actions
											</th>
										</tr>
									</thead>
									<tbody className="bg-white divide-y divide-gray-200">
										{users.map((user) => (
											<tr key={user.id} className="hover:bg-gray-50">
												<td className="px-6 py-4 whitespace-nowrap">
													<div className="flex items-center">
														<div className="flex-shrink-0 h-10 w-10">
															<div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
																<span className="text-sm font-medium text-blue-600">
																	{user.username.charAt(0).toUpperCase()}
																</span>
															</div>
														</div>
														<div className="ml-4">
															<div className="text-sm font-medium text-gray-900">
																{user.username}
															</div>
															<div className="text-sm text-gray-500">
																ID: {user.id}
															</div>
														</div>
													</div>
												</td>
												<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
													{user.email}
												</td>
												<td className="px-6 py-4 whitespace-nowrap">
													<span
														className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
															user.isAdmin
																? "bg-red-100 text-red-800"
																: "bg-green-100 text-green-800"
														}`}
													>
														{user.isAdmin ? "Admin" : "User"}
													</span>
												</td>
												<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
													{new Date(user.createdAt).toLocaleDateString()}
												</td>
												<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
													{(user as any).posts?.length || 0}
												</td>
												<td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
													{user.id !== currentUser?.getCurrentUser?.id && (
														<button
															type="button"
															onClick={() =>
																handleDeleteUser(user.id, user.username)
															}
															className="text-red-600 hover:text-red-900 transition-colors"
														>
															Delete
														</button>
													)}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>

							{/* Pagination */}
							<div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
								<div className="flex-1 flex justify-between sm:hidden">
									<button
										type="button"
										onClick={() =>
											handlePageChange(Math.max(0, offset - limit))
										}
										disabled={!hasPrevPage}
										className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
									>
										Previous
									</button>
									<button
										type="button"
										onClick={() => handlePageChange(offset + limit)}
										disabled={!hasNextPage}
										className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
									>
										Next
									</button>
								</div>
								<div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
									<div>
										<p className="text-sm text-gray-700">
											Showing <span className="font-medium">{offset + 1}</span>{" "}
											to{" "}
											<span className="font-medium">
												{offset + users.length}
											</span>{" "}
											users
										</p>
									</div>
									<div>
										<nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
											<button
												type="button"
												onClick={() =>
													handlePageChange(Math.max(0, offset - limit))
												}
												disabled={!hasPrevPage}
												className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
											>
												Previous
											</button>
											<button
												type="button"
												onClick={() => handlePageChange(offset + limit)}
												disabled={!hasNextPage}
												className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
											>
												Next
											</button>
										</nav>
									</div>
								</div>
							</div>
						</>
					)}
				</div>

				{/* Real-time indicator */}
				<div className="mt-8 text-center">
					<div className="inline-flex items-center space-x-2 text-sm text-gray-500">
						<div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
						<span>Real-time updates enabled</span>
					</div>
				</div>
			</div>
		</div>
	);
}
