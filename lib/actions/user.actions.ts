/*
Reduced client-side javascripts. Ensuring that these codes should be rendered only on the server. 
Reference: https://nextjs.org/docs/app/api-reference/functions/server-actions
*/
"use server";

import { revalidatePath } from "next/cache";

import { connectToDB } from "@/lib/mongoose";
import User from "@/lib/models/user.model";

interface Params {
  id: string;
  username: string;
  name: string;
  bio: string;
  image: string;
  path: string;
}

/**
 * API - Update a user info in the "User" table.
 * @param param0 - User object
 */
export async function updateUser({
  id,
  username,
  name,
  bio,
  image,
  path,
}: Params): Promise<void> {
  try {
    // Connect to DB first
    connectToDB();

    // Upsert a User object
    await User.findOneAndUpdate(
      { id: id },
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
    throw new Error(`[LOG] Failed to create/update user: ${error.message}`);
  }
}

/**
 * API - Get/Fetch a user info from "User" table via user's id.
 * @param id
 * @returns
 */
export async function fetchUser(id: string) {
  try {
    // Connect to DB first
    connectToDB();

    // Find a User info based on user's id
    return await User.findOne({ id: id });
    // .populate({
    //     path: "communities",
    //     model: Community
    // })
  } catch (error: any) {
    throw new Error(`[LOG] Failed to fetch user: ${error.message}`);
  }
}
