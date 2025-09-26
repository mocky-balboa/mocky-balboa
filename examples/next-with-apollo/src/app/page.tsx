"use client";

import { useId, useState } from "react";
import { PostStatus } from "@/graphql/generated";
import { useCreatePost } from "@/graphql/hooks/useCreatePost";
import { useDeletePost } from "@/graphql/hooks/useDeletePost";
import { useGetAllPosts } from "@/graphql/hooks/useGetAllPosts";
import { useGetCurrentUser } from "@/graphql/hooks/useGetCurrentUser";
import { useNewPostPublished } from "@/graphql/hooks/useNewPostPublished";
import { usePublishPost } from "@/graphql/hooks/usePublishPost";

export default function Home() {
	const [showCreateForm, setShowCreateForm] = useState(false);
	const [newPost, setNewPost] = useState({
		title: "",
		content: "",
		tags: [] as string[],
	});
	const [tagInput, setTagInput] = useState("");

	const titleId = useId();
	const contentId = useId();
	const tagsId = useId();

	// Queries
	const { data: currentUser, loading: userLoading } = useGetCurrentUser({});
	const {
		data: postsData,
		loading: postsLoading,
		refetch,
	} = useGetAllPosts({});

	// Mutations
	const [createPost, { loading: creating }] = useCreatePost({
		onCompleted: () => {
			setNewPost({ title: "", content: "", tags: [] });
			setShowCreateForm(false);
			refetch();
		},
	});

	const [publishPost] = usePublishPost({
		onCompleted: () => refetch(),
	});

	const [deletePost] = useDeletePost({
		onCompleted: () => refetch(),
	});

	// Real-time subscription for new posts
	useNewPostPublished({
		onData: ({ data }) => {
			if (data?.data?.newPostPublished) {
				refetch();
			}
		},
	});

	const handleCreatePost = () => {
		createPost({
			variables: {
				input: {
					title: newPost.title,
					content: newPost.content,
					tags: newPost.tags.length > 0 ? newPost.tags : undefined,
				},
			},
		});
	};

	const handleAddTag = () => {
		if (tagInput.trim() && !newPost.tags.includes(tagInput.trim())) {
			setNewPost({ ...newPost, tags: [...newPost.tags, tagInput.trim()] });
			setTagInput("");
		}
	};

	const handleRemoveTag = (tagToRemove: string) => {
		setNewPost({
			...newPost,
			tags: newPost.tags.filter((tag) => tag !== tagToRemove),
		});
	};

	const handlePublishPost = (postId: string) => {
		publishPost({ variables: { postId } });
	};

	const handleDeletePost = (postId: string) => {
		if (confirm("Are you sure you want to delete this post?")) {
			deletePost({ variables: { postId } });
		}
	};

	if (userLoading || postsLoading) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
					<p className="mt-4 text-gray-600">Loading...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50">
			{/* Page Header */}
			<div className="bg-white border-b">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
					<div className="flex justify-between items-center">
						<div>
							<h1 className="text-3xl font-bold text-gray-900">
								Mocky Balboa Blog
							</h1>
							<p className="text-gray-600 mt-1">
								Showcasing GraphQL Operations
							</p>
						</div>
						<button
							type="button"
							onClick={() => setShowCreateForm(!showCreateForm)}
							className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
						>
							{showCreateForm ? "Cancel" : "New Post"}
						</button>
					</div>
				</div>
			</div>

			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				{/* Create Post Form */}
				{showCreateForm && (
					<div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
						<h2 className="text-xl font-semibold mb-4">Create New Post</h2>
						<div className="space-y-4">
							<div>
								<label
									htmlFor={titleId}
									className="block text-sm font-medium text-gray-700 mb-1"
								>
									Title
								</label>
								<input
									id={titleId}
									type="text"
									value={newPost.title}
									onChange={(e) =>
										setNewPost({ ...newPost, title: e.target.value })
									}
									className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Enter post title"
								/>
							</div>
							<div>
								<label
									htmlFor={contentId}
									className="block text-sm font-medium text-gray-700 mb-1"
								>
									Content
								</label>
								<textarea
									id={contentId}
									value={newPost.content}
									onChange={(e) =>
										setNewPost({ ...newPost, content: e.target.value })
									}
									rows={4}
									className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Enter post content"
								/>
							</div>
							<div>
								<label
									htmlFor={tagsId}
									className="block text-sm font-medium text-gray-700 mb-1"
								>
									Tags
								</label>
								<div className="flex space-x-2 mb-2">
									<input
										id={tagsId}
										type="text"
										value={tagInput}
										onChange={(e) => setTagInput(e.target.value)}
										onKeyPress={(e) => e.key === "Enter" && handleAddTag()}
										className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
										placeholder="Add a tag"
									/>
									<button
										type="button"
										onClick={handleAddTag}
										className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
									>
										Add
									</button>
								</div>
								{newPost.tags.length > 0 && (
									<div className="flex flex-wrap gap-2">
										{newPost.tags.map((tag) => (
											<span
												key={tag}
												className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
											>
												{tag}
												<button
													type="button"
													onClick={() => handleRemoveTag(tag)}
													className="ml-1 text-blue-600 hover:text-blue-800"
												>
													×
												</button>
											</span>
										))}
									</div>
								)}
							</div>
							<div className="flex space-x-3">
								<button
									type="button"
									onClick={handleCreatePost}
									disabled={!newPost.title || !newPost.content || creating}
									className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
								>
									{creating ? "Creating..." : "Create Post"}
								</button>
								<button
									type="button"
									onClick={() => setShowCreateForm(false)}
									className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
								>
									Cancel
								</button>
							</div>
						</div>
					</div>
				)}

				{/* Posts List */}
				<div className="space-y-6">
					<div className="flex items-center justify-between">
						<h2 className="text-2xl font-bold text-gray-900">Recent Posts</h2>
						<div className="text-sm text-gray-500">
							{postsData?.getAllPosts?.length || 0} posts
						</div>
					</div>

					{postsData?.getAllPosts?.length === 0 ? (
						<div className="text-center py-12">
							<div className="text-gray-400 text-6xl mb-4">📝</div>
							<h3 className="text-lg font-medium text-gray-900 mb-2">
								No posts yet
							</h3>
							<p className="text-gray-500">
								Create your first post to get started!
							</p>
						</div>
					) : (
						<div className="grid gap-6">
							{postsData?.getAllPosts?.map((post) => (
								<div
									key={post.id}
									className="bg-white rounded-lg shadow-sm border p-6"
								>
									<div className="flex items-start justify-between">
										<div className="flex-1">
											<div className="flex items-center space-x-2 mb-2">
												<h3 className="text-xl font-semibold text-gray-900">
													{post.title}
												</h3>
												<span
													className={`px-2 py-1 text-xs font-medium rounded-full ${
														post.status === PostStatus.Published
															? "bg-green-100 text-green-800"
															: post.status === PostStatus.Draft
																? "bg-yellow-100 text-yellow-800"
																: "bg-gray-100 text-gray-800"
													}`}
												>
													{post.status}
												</span>
											</div>
											<p className="text-gray-600 mb-4">{post.content}</p>
											<div className="flex items-center space-x-4 text-sm text-gray-500">
												<span>By {post.author.username}</span>
												{post.publishedAt && (
													<span>
														Published:{" "}
														{new Date(post.publishedAt).toLocaleDateString()}
													</span>
												)}
												{post.tags && post.tags.length > 0 && (
													<div className="flex space-x-1">
														{post.tags.map((tag: string) => (
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
										<div className="flex space-x-2 ml-4">
											{post.status === PostStatus.Draft && (
												<button
													type="button"
													onClick={() => handlePublishPost(post.id)}
													className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
												>
													Publish
												</button>
											)}
											<button
												type="button"
												onClick={() => handleDeletePost(post.id)}
												className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
											>
												Delete
											</button>
										</div>
									</div>
								</div>
							))}
						</div>
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
