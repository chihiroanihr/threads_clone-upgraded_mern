/*
Reduced client-side javascripts. Ensuring that these codes should be rendered only on the server. 
Reference: https://nextjs.org/docs/app/api-reference/functions/server-actions
*/
"use server";

import { revalidatePath } from "next/cache";
import { FilterQuery, SortOrder, Types } from "mongoose";

import { connectToDB } from "@/lib/mongoose";
import Thread from "@/lib/models/thread.model";
import User from "@/lib/models/user.model";
import Community from "@/lib/models/community.model";

interface UpdateUserParams {
  userId: string;
  username: string;
  name: string;
  bio: string;
  image: string;
  path: string;
}

interface FetchUsersFromSearchParams {
  userId: string;
  searchString?: string;
  pageNumber?: number;
  pageSize?: number;
  sortBy?: SortOrder;
}

// Connect to the DB
connectToDB();

/**
 * API - Update a user info in the "User" table via user ID.
 * @param param0 - User object
 */
export async function updateUser({
  userId,
  username,
  name,
  bio,
  image,
  path,
}: UpdateUserParams): Promise<void> {
  try {
    // Upsert a User object
    await User.findOneAndUpdate(
      { id: userId },
      { username: username.toLowerCase(), name, bio, image, onboarded: true },
      { upsert: true } // "Insert" + "Update"
      /*
      Upsert: Update an existing row if a value already exists in a table, 
      and insert a new row if the valu edoes not already exist in the table.
      */
    );

    // Update cached data without waiting for a revalidation period to expire.
    if (path === "/profile/edit") {
      revalidatePath(path);
    }
  } catch (error: any) {
    throw new Error(
      `[LOG] Error updating / creating new user: ${error.message}`
    );
  }
}

/**
 * API - Get/Fetch a user info from the "User" table via user ID.
 * @param userId - User ID
 * @returns
 */
export async function fetchUser(userId: string) {
  try {
    // Find a User info based on user's id
    return await User.findOne({ id: userId })
      // Get communities that the user belongs to
      .populate({
        path: "communities",
        model: Community,
      });
  } catch (error: any) {
    throw new Error(`[LOG] Error fetching user: ${error.message}`);
  }
}

/**
 * API - Get/Fetch ALL threads and its children threads (comments/replies) which belongs to the given user ID.
 * @param userId - User ID
 * @returns
 */
export async function fetchUserThreads(
  userObjectId: Types.ObjectId
): Promise<any[]> {
  try {
    // Define a recursive function to fetch children threads
    const fetchChildrenThreads = async (parentThread: any) => {
      const childrenThreads = await Promise.all(
        // Iterat all its childrens
        parentThread.children.map(
          async (childThreadObjectId: Types.ObjectId) => {
            // Get Thread object via its child thread object ID
            const childThread = await Thread.findById(childThreadObjectId);
            // Recursive function
            return fetchChildrenThreads(childThread);
          }
        )
      );

      // Return the result with the following format:
      return { ...parentThread.toObject(), children: childrenThreads };
    };

    // Use the user's _id to query threads authored by the user
    const userThreads = await Thread.find({
      author: userObjectId,
      parentId: null, // only retrieve top-level threads
    });

    // Collect all top-level threads and their nested children
    const topLevelThreads = await Promise.all(
      userThreads.map(async (userThread) => {
        // Get author (user) of the thread
        const userObj = await User.findById(userThread.author);
        // Get community that thread belongs to
        const communityObj = await Community.findById(userThread.community);
        // Get all its children threads
        const childrenThreads: any[] = await Promise.all(
          // Iterate all its childrens
          userThread.children.map(
            async (childThreadObjectId: Types.ObjectId) => {
              // Get Thread object via its child thread object ID
              const childThread = await Thread.findById(childThreadObjectId)
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
                });
              // Recursive function
              return fetchChildrenThreads(childThread);
            }
          )
        );

        // Return the result with the following format:
        return {
          _id: userThread._id,
          text: userThread.text,
          author: {
            _id: userObj._id,
            id: userObj.id,
            username: userObj.username,
            image: userObj.image,
          },
          community: communityObj
            ? {
                _id: communityObj._id,
                id: communityObj.id,
                name: communityObj.name,
                image: communityObj.image,
              }
            : null,
          createdAt: userThread.createdAt,
          children: childrenThreads,
        };
      })
    );

    return topLevelThreads;
  } catch (error: any) {
    throw new Error(`Error fetching user threads: ${error.message}`);
  }
}

/**
 * API - Get/Fetch ALL users based on the search string given.
 * @param param0 - Search input and page info object
 * @returns
 */
export async function fetchUsersFromSearch({
  userId,
  searchString = "",
  pageNumber = 1,
  pageSize = 20,
  sortBy = "desc",
}: FetchUsersFromSearchParams) {
  try {
    // Get search string as regex
    const regex = new RegExp(searchString, "i"); // case-insensitive

    // Define query filters
    const query: FilterQuery<typeof User> = {
      id: { $ne: userId }, // $ne = "not equal to" : filter-out current user ID.
    };
    // If search string exists
    if (searchString.trim() !== "") {
      // $or conditions : match either by username or name
      query.$or = [
        { username: { $regex: regex } },
        { name: { $regex: regex } },
      ];
    }

    // Fetch all users that matches with the query filtered above
    const users = await User.find(query)
      .sort({ createdAt: sortBy }) // sort options
      .skip((pageNumber - 1) * pageSize) // number of posts to skip depending on current page
      .limit(pageSize)
      .lean(); // for improved performance

    // Get total count of users without fetching all documents
    const totalUsersCount = await User.countDocuments(query);

    // Next page exists
    const isNext = totalUsersCount > pageNumber * pageSize;

    return { users, isNext };
  } catch (error: any) {
    throw new Error(`[LOG] Error fetching users: ${error.message}`);
  }
}

/**
 * API - Get/Fetch ALL children threads (replies) that are made by others towards the given user ID (currently logged-in user).
 * (Reply threads are fetched from the "Thread" table)
 * @param userId - User ID
 * @returns
 */
export async function getActivity(userId: string) {
  try {
    // Find all threads created by the user
    const userThreads = await Thread.find({ author: userId });

    // Collect all child thread (comments/replies) IDs from the "children" field
    const childrenThreadIds = userThreads.reduce(
      (acc, userThread) => {
        return acc.concat(userThread.children); // Retrieves object _id.
      },
      [] // default acc
      /*
      1. acc: Accumulates the children threads from an array of "userThreads".
      2. concat(): Creates a new array by merging the accumulated elements ("acc" array) with the "userThread.children" array.
      3. reduce(): Concatenate all the child thread object IDs (_id) from each "userThread" into a single array stored in the "childrenThreadIds".
      */
    );

    // Fetch all replies **made by other users** from the children threads created
    return await Thread.find({
      _id: { $in: childrenThreadIds }, // thread ID exists in children threads
      author: { $ne: userId }, // author is not current user ID (must exclude curent user ID)
    }).populate({
      path: "author",
      model: User,
      select: "username image _id",
    });
  } catch (error: any) {
    throw new Error(`[LOG] Error fetching activity: ${error.message}`);
  }
}
