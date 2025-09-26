"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Theme } from "@/graphql/generated";
import { useGetCurrentUser } from "@/graphql/hooks/useGetCurrentUser";
import { useUpdateUserPreferences } from "@/graphql/hooks/useUpdateUserPreferences";
import { useUserStatusUpdated } from "@/graphql/hooks/useUserStatusUpdated";

export default function ProfilePage() {
	const [preferences, setPreferences] = useState({
		theme: Theme.Light,
		notificationsEnabled: true,
	});

	const themeId = useId();
	const notificationsId = useId();
	const usernameId = useId();
	const emailId = useId();
	const roleId = useId();
	const memberSinceId = useId();

	const {
		data: currentUser,
		loading: userLoading,
		refetch,
	} = useGetCurrentUser({});

	const [updatePreferences, { loading: updating }] = useUpdateUserPreferences({
		onCompleted: () => {
			refetch();
		},
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

	const handleUpdatePreferences = () => {
		updatePreferences({
			variables: {
				preferences: {
					theme: preferences.theme,
					notificationsEnabled: preferences.notificationsEnabled,
				},
			},
		});
	};

	if (userLoading) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
					<p className="mt-4 text-gray-600">Loading...</p>
				</div>
			</div>
		);
	}

	if (!currentUser?.getCurrentUser) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<div className="text-center">
					<h1 className="text-2xl font-bold text-gray-900 mb-4">
						Not Authenticated
					</h1>
					<p className="text-gray-600 mb-6">
						Please log in to view your profile.
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

	const user = currentUser.getCurrentUser;

	return (
		<div className="min-h-screen bg-gray-50">
			{/* Header */}
			<header className="bg-white shadow-sm border-b">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
					<div className="flex items-center justify-between">
						<div>
							<h1 className="text-3xl font-bold text-gray-900">Profile</h1>
							<p className="text-gray-600 mt-1">Manage your account settings</p>
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
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
					{/* User Info */}
					<div className="lg:col-span-2">
						<div className="bg-white rounded-lg shadow-sm border p-6">
							<h2 className="text-xl font-semibold mb-6">User Information</h2>
							<div className="space-y-4">
								<div>
									<label
										htmlFor={usernameId}
										className="block text-sm font-medium text-gray-700 mb-1"
									>
										Username
									</label>
									<div
										id={usernameId}
										className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md"
									>
										{user.username}
									</div>
								</div>
								<div>
									<label
										htmlFor={emailId}
										className="block text-sm font-medium text-gray-700 mb-1"
									>
										Email
									</label>
									<div
										id={emailId}
										className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md"
									>
										{user.email}
									</div>
								</div>
								<div>
									<label
										htmlFor={roleId}
										className="block text-sm font-medium text-gray-700 mb-1"
									>
										Role
									</label>
									<div
										id={roleId}
										className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md"
									>
										{user.isAdmin ? "Administrator" : "User"}
									</div>
								</div>
								<div>
									<label
										htmlFor={memberSinceId}
										className="block text-sm font-medium text-gray-700 mb-1"
									>
										Member Since
									</label>
									<div
										id={memberSinceId}
										className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md"
									>
										{new Date((user as any).createdAt).toLocaleDateString()}
									</div>
								</div>
							</div>
						</div>

						{/* User Posts */}
						<div className="bg-white rounded-lg shadow-sm border p-6 mt-6">
							<h2 className="text-xl font-semibold mb-6">Your Posts</h2>
							{(user as any).posts && (user as any).posts.length > 0 ? (
								<div className="space-y-4">
									{(user as any).posts.map((post: any) => (
										<div
											key={post.id}
											className="border border-gray-200 rounded-lg p-4"
										>
											<div className="flex items-center justify-between">
												<div>
													<h3 className="font-medium text-gray-900">
														{post.title}
													</h3>
													<p className="text-sm text-gray-500 mt-1">
														{post.status} •{" "}
														{post.publishedAt
															? new Date(post.publishedAt).toLocaleDateString()
															: "Not published"}
													</p>
												</div>
												<span
													className={`px-2 py-1 text-xs font-medium rounded-full ${
														post.status === "PUBLISHED"
															? "bg-green-100 text-green-800"
															: post.status === "DRAFT"
																? "bg-yellow-100 text-yellow-800"
																: "bg-gray-100 text-gray-800"
													}`}
												>
													{post.status}
												</span>
											</div>
										</div>
									))}
								</div>
							) : (
								<div className="text-center py-8">
									<div className="text-gray-400 text-4xl mb-4">📝</div>
									<p className="text-gray-500">No posts yet</p>
									<Link
										href="/"
										className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
									>
										Create Your First Post
									</Link>
								</div>
							)}
						</div>
					</div>

					{/* Preferences */}
					<div className="lg:col-span-1">
						<div className="bg-white rounded-lg shadow-sm border p-6">
							<h2 className="text-xl font-semibold mb-6">Preferences</h2>
							<div className="space-y-6">
								<div>
									<label
										htmlFor={themeId}
										className="block text-sm font-medium text-gray-700 mb-2"
									>
										Theme
									</label>
									<select
										id={themeId}
										value={preferences.theme}
										onChange={(e) =>
											setPreferences({
												...preferences,
												theme: e.target.value as Theme,
											})
										}
										className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									>
										<option value={Theme.Light}>Light</option>
										<option value={Theme.Dark}>Dark</option>
										<option value={Theme.System}>System</option>
									</select>
								</div>

								<div>
									<label
										htmlFor={notificationsId}
										className="flex items-center"
									>
										<input
											id={notificationsId}
											type="checkbox"
											checked={preferences.notificationsEnabled}
											onChange={(e) =>
												setPreferences({
													...preferences,
													notificationsEnabled: e.target.checked,
												})
											}
											className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
										/>
										<span className="ml-2 text-sm text-gray-700">
											Enable notifications
										</span>
									</label>
								</div>

								<button
									type="button"
									onClick={handleUpdatePreferences}
									disabled={updating}
									className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
								>
									{updating ? "Updating..." : "Update Preferences"}
								</button>
							</div>

							{/* Current Preferences Display */}
							{user.preferences && (
								<div className="mt-6 pt-6 border-t border-gray-200">
									<h3 className="text-sm font-medium text-gray-700 mb-3">
										Current Settings
									</h3>
									<div className="space-y-2 text-sm">
										<div className="flex justify-between">
											<span className="text-gray-500">Theme:</span>
											<span className="text-gray-900">
												{user.preferences.theme}
											</span>
										</div>
										<div className="flex justify-between">
											<span className="text-gray-500">Notifications:</span>
											<span className="text-gray-900">
												{user.preferences.notificationsEnabled
													? "Enabled"
													: "Disabled"}
											</span>
										</div>
										<div className="flex justify-between">
											<span className="text-gray-500">Language:</span>
											<span className="text-gray-900">
												{user.preferences.language}
											</span>
										</div>
									</div>
								</div>
							)}
						</div>

						{/* Real-time indicator */}
						<div className="mt-6 text-center">
							<div className="inline-flex items-center space-x-2 text-sm text-gray-500">
								<div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
								<span>Real-time updates enabled</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
