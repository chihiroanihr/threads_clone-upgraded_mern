/*
Reduced client-side javascripts. Ensuring that these codes should be rendered only on the server. 
Reference: https://nextjs.org/docs/app/api-reference/functions/server-actions
*/
"use server";

import { revalidatePath } from "next/cache";

import { connectToDB } from "@/lib/mongoose";
import Thread from "@/lib/models/thread.model";
import User from "@/lib/models/user.model";

interface CreateThreadParams {
  text: string;
  author: string;
  communityId: string | null;
  path: string;
}

/**
 * API - Insert a thread in the "Thread" table.
 * @param param0 - Thread object
 */
export async function createThread({
  text,
  author,
  communityId,
  path,
}: CreateThreadParams) {
  try {
    // Connect to DB first
    connectToDB();

    // Create/Insert a Thread object
    const threadCreated = await Thread.create({
      text,
      author,
      community: null,
    });

    // Update user model (Push the thread to the specific author)
    await User.findByIdAndUpdate(author, {
      $push: { threads: threadCreated._id },
    });

    // Update cached data without waiting for a revalidation period to expire.
    revalidatePath(path);
  } catch (error: any) {
    throw new Error(`[LOG] Error creating thread: ${error.message}`);
  }
}

/**
 * API - Get/Fetch ALL thread posts from the "Thread" table.
 * @param pageNumber - Current page number
 * @param pageSize - Maximum thread posts number in a single page
 * @returns
 */
export async function fetchThreads(pageNumber = 1, pageSize = 20) {
  try {
    // Connect to DB first
    connectToDB();

    // Calculate the number of posts to skip depending on current page
    const skipAmount = (pageNumber - 1) * pageSize;

    // Fetch all the (top-level) thread posts that (which have no more parents than itself)
    const threadsQuery = Thread.find({ parentId: { $in: [null, undefined] } }) // "parentId is in NULL or UNDEFINED."
      .sort({ createdAt: "desc" }) // order latest.
      .skip(skipAmount)
      .limit(pageSize)
      // Get author user information
      .populate({ path: "author", model: User })
      // Get related comments threads
      .populate({
        path: "children",
        // Get author user information for each comments threads
        populate: {
          path: "author",
          model: User,
          select: "_id username parentId image",
        },
      });

    // Execute the above query
    const threads = await threadsQuery.exec();

    // Get total number of (top-level) thread posts
    const totalThreadsCount = await Thread.countDocuments({
      parentId: { $in: [null, undefined] },
    });

    // Next page exists
    const isNext = totalThreadsCount > skipAmount + threads.length;

    return { threads, isNext };
  } catch (error: any) {
    throw new Error(`[LOG] Error creating thread: ${error.message}`);
  }
}

/**
 * API - Get/Fetch a thred post from the "Thread" table via (thread) object id.
 * @param id - Thread object ID
 * @returns
 */
export async function fetchThreadById(id: string) {
  try {
    // Connect to DB first
    connectToDB();

    const thread = await Thread.findById(id)
      // Get author user information
      .populate({
        path: "author",
        model: User,
        select: "_id id username image",
      })

      /* TODO: Populate the community field with _id and name */

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
      })
      // Execute the query
      .exec();

    return thread;
  } catch (error: any) {
    throw new Error(`Error fetching thread: ${error.message}`);
  }
}
