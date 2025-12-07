"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { PostStatus } from "@/graphql/generated";
import { useSearchPosts } from "@/graphql/hooks/useSearchPosts";

export default function SearchPage() {
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedStatus, setSelectedStatus] = useState<PostStatus | "">("");
	const [minDate, setMinDate] = useState("");

	const searchId = useId();
	const statusId = useId();
	const dateId = useId();

	const {
		data: searchData,
		loading,
		refetch,
	} = useSearchPosts({
		variables: {
			filter: {
				searchQuery: searchQuery || undefined,
				status: selectedStatus || undefined,
				minPublishedDate: minDate || undefined,
			},
		},
		skip: !searchQuery && !selectedStatus && !minDate,
	});

	const handleSearch = () => {
		refetch();
	};

	const handleClearFilters = () => {
		setSearchQuery("");
		setSelectedStatus("");
		setMinDate("");
	};

	const isPostStatus = (status: string): status is PostStatus => {
		return Object.values(PostStatus).includes(status as PostStatus);
	};

	return (
		<div className="min-h-screen bg-gray-50">
			{/* Header */}
			<header className="bg-white shadow-sm border-b">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex justify-between items-center py-6">
						<div>
							<h1 className="text-3xl font-bold text-gray-900">Search Posts</h1>
							<p className="text-gray-600 mt-1">
								Find posts using advanced filters
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
				{/* Search Form */}
				<div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
					<h2 className="text-xl font-semibold mb-4">Search Filters</h2>
					<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
						<div>
							<label
								htmlFor={searchId}
								className="block text-sm font-medium text-gray-700 mb-1"
							>
								Search Query
							</label>
							<input
								id={searchId}
								type="text"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								placeholder="Search in title and content..."
							/>
						</div>
						<div>
							<label
								htmlFor={statusId}
								className="block text-sm font-medium text-gray-700 mb-1"
							>
								Status
							</label>
							<select
								id={statusId}
								value={selectedStatus}
								onChange={(e) =>
									setSelectedStatus(
										(isPostStatus(e.target.value) ? e.target.value : "") ?? "",
									)
								}
								className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							>
								<option value="">All Statuses</option>
								<option value={PostStatus.Draft}>Draft</option>
								<option value={PostStatus.Published}>Published</option>
								<option value={PostStatus.Archived}>Archived</option>
							</select>
						</div>
						<div>
							<label
								htmlFor={dateId}
								className="block text-sm font-medium text-gray-700 mb-1"
							>
								Published After
							</label>
							<input
								id={dateId}
								type="date"
								value={minDate}
								onChange={(e) => setMinDate(e.target.value)}
								className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
						</div>
						<div className="flex items-end space-x-2">
							<button
								type="button"
								onClick={handleSearch}
								disabled={loading}
								className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
							>
								{loading ? "Searching..." : "Search"}
							</button>
							<button
								type="button"
								onClick={handleClearFilters}
								className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
							>
								Clear
							</button>
						</div>
					</div>
				</div>

				{/* Search Results */}
				<div className="space-y-6">
					<div className="flex items-center justify-between">
						<h2 className="text-2xl font-bold text-gray-900">Search Results</h2>
						{searchData?.searchPosts && (
							<div className="text-sm text-gray-500">
								{searchData.searchPosts.length} posts found
							</div>
						)}
					</div>

					{loading ? (
						<div className="text-center py-12">
							<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
							<p className="mt-4 text-gray-600">Searching...</p>
						</div>
					) : !searchQuery && !selectedStatus && !minDate ? (
						<div className="text-center py-12">
							<div className="text-gray-400 text-6xl mb-4">🔍</div>
							<h3 className="text-lg font-medium text-gray-900 mb-2">
								Start Your Search
							</h3>
							<p className="text-gray-500">
								Use the filters above to find posts
							</p>
						</div>
					) : searchData?.searchPosts?.length === 0 ? (
						<div className="text-center py-12">
							<div className="text-gray-400 text-6xl mb-4">📭</div>
							<h3 className="text-lg font-medium text-gray-900 mb-2">
								No Results Found
							</h3>
							<p className="text-gray-500">
								Try adjusting your search criteria
							</p>
						</div>
					) : (
						<div className="grid gap-6">
							{searchData?.searchPosts?.map((post) => {
								const postData = post;
								return (
									<div
										key={postData.id}
										className="bg-white rounded-lg shadow-sm border p-6"
									>
										<div className="flex items-start justify-between">
											<div className="flex-1">
												<div className="flex items-center space-x-2 mb-2">
													<h3 className="text-xl font-semibold text-gray-900">
														{postData.title}
													</h3>
													<span
														className={`px-2 py-1 text-xs font-medium rounded-full ${
															postData.status === PostStatus.Published
																? "bg-green-100 text-green-800"
																: postData.status === PostStatus.Draft
																	? "bg-yellow-100 text-yellow-800"
																	: "bg-gray-100 text-gray-800"
														}`}
													>
														{postData.status}
													</span>
												</div>
												<p className="text-gray-600 mb-4">{postData.content}</p>
												<div className="flex items-center space-x-4 text-sm text-gray-500">
													<span>By {postData.author.username}</span>
													{postData.publishedAt && (
														<span>
															Published:{" "}
															{new Date(
																postData.publishedAt,
															).toLocaleDateString()}
														</span>
													)}
													{postData.tags && postData.tags.length > 0 && (
														<div className="flex space-x-1">
															{postData.tags.map((tag: string) => (
																<span
																	key={tag}
																	className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs"
																>
																	{tag}
																</span>
															))}
														</div>
													)}
												</div>
											</div>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
