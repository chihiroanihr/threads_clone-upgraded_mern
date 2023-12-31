/*
Reduced client-side javascripts. Ensuring that these codes should be rendered only on the server. 
Reference: https://nextjs.org/docs/app/api-reference/functions/server-actions
*/
"use server";

import { revalidatePath } from "next/cache";

import { connectToDB } from "@/lib/mongoose";
import Thread from "@/lib/models/thread.model";
import User from "@/lib/models/user.model";
import Community from "@/lib/models/community.model";

interface CreateThreadParams {
  text: string;
  author: string;
  communityId: string | null;
  path: string;
}

interface FetchThreadsParams {
  pageNumber?: number;
  pageSize?: number;
}

interface AddCommentToThreadParams {
  originalThreadId: string;
  commentedText: string;
  commentedAuthor: string;
  commentedFromCommunity: string | null;
  path: string;
}

// Connect to the DB
connectToDB();

/**
 * API - Insert a new thread in the "Thread" table created by given user.
 * @param param0 - Thread object
 */
export async function createThread({
  text,
  author,
  communityId,
  path,
}: CreateThreadParams) {
  try {
    const communityIdObject = await Community.findOne(
      { id: communityId },
      { _id: 1 }
    );

    // Create/Insert a Thread object
    const newThread = await Thread.create({
      text,
      author,
      community: communityIdObject, // Assign communityId if provided, or leave it null for personal account
    });

    // Update "User" table (Push the thread to the specific author)
    await User.findByIdAndUpdate(author, {
      $push: { threads: newThread._id },
    });

    // Update "Community" table if community exists (Push the thread to the community)
    if (communityIdObject) {
      await Community.findByIdAndUpdate(communityIdObject, {
        $push: { threads: newThread._id },
      });
    }

    // Update cached data without waiting for a revalidation period to expire.
    revalidatePath(path);
  } catch (error: any) {
    throw new Error(`[LOG] Error creating thread: ${error.message}`);
  }
}

/**
 * API - Get/Fetch ALL threads from the "Thread" table.
 * @param param0 - Page info object
 * @returns
 */
export async function fetchThreads({
  pageNumber = 1,
  pageSize = 20,
}: FetchThreadsParams) {
  try {
    // Define the query for top-level threads (which have no more parents than itself)
    const query = { parentId: { $in: [null, undefined] } }; // $in condition : "parentId" is in NULL or UNDEFINED

    // Fetch all the top-level threads matches with the query filtered above
    const threads = await Thread.find(query)
      .sort({ createdAt: "desc" }) // order latest
      .skip((pageNumber - 1) * pageSize) // number of posts to skip depending on current page
      .limit(pageSize)
      // Get author user information
      .populate({ path: "author", model: User })
      // Get related community
      .populate({
        path: "community",
        model: Community,
      })
      // Get related comments threads
      .populate({
        path: "children",
        // Get author user information for each comments threads
        populate: {
          path: "author",
          model: User,
          select: "_id username parentId image",
        },
      })
      .lean(); // for improved performance

    // Get the total number of top-level threads without fetching all documents
    const totalThreadsCount = await Thread.countDocuments(query);

    // Next page exists
    const isNext = totalThreadsCount > pageNumber * pageSize;

    return { threads, isNext };
  } catch (error: any) {
    throw new Error(`[LOG] Error fetching threads: ${error.message}`);
  }
}

/**
 * API - Get/Fetch a thread from the "Thread" table based on its object ID.
 * @param id - Thread object ID
 * @returns
 */
export async function fetchThreadById(id: string) {
  try {
    return await Thread.findById(id)
      // Get related author user information
      .populate({
        path: "author",
        model: User,
        select: "_id id username image",
      })
      // Get related community
      .populate({
        path: "community",
        model: Community,
        select: "_id id name image",
      })
      // Get related comments threads (nested!)
      .populate({
        path: "children",
        populate: [
          // Get author user information for each comments threads
          {
            path: "author",
            model: User,
            select: "_id id username parentId image",
          },
          // Get related comments threads for each comments threads
          {
            path: "children",
            model: Thread,
            populate: {
              // Get author user information for each comments threads
              path: "author",
              model: User,
              select: "_id id username parentId image",
            },
          },
        ],
      });
  } catch (error: any) {
    throw new Error(`[LOG] Error fetching thread: ${error.message}`);
  }
}

/**
 * API
 * 1. Insert a new thread (comment/reply thread) in the "Thread" table.
 * 2. Update the original thread to include the newly created child thread (comment/reply thread).
 * @param param0 - Comment thread object
 */
export async function addCommentToThread({
  originalThreadId,
  commentedText,
  commentedAuthor,
  commentedFromCommunity,
  path,
}: AddCommentToThreadParams) {
  try {
    // Find the original thread by its id
    const originalThread = await Thread.findById(originalThreadId);
    // If original thread not found
    if (!originalThread) {
      throw new Error("[LOG] Original thread not found.");
    }

    // Create a new thread with the comment text
    const commentThread = new Thread({
      text: commentedText,
      author: commentedAuthor,
      community: commentedFromCommunity,
      parentId: originalThreadId,
    });
    // Save the new thread
    const savedCommentThread = await commentThread.save();

    // Update the original thread to include the new comment threads
    originalThread.children.push(savedCommentThread._id);
    // Save the original thread
    await originalThread.save();

    // Update cached data without waiting for a revalidation period to expire.
    revalidatePath(path);
  } catch (error: any) {
    throw new Error(
      `[LOG] Error adding comment thread to the original thread: ${error.message}`
    );
  }
}
