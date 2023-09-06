"use client"; // useRouter() only works in client-side.

import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { SignedIn, SignOutButton } from "@clerk/nextjs";
import { twMerge } from "tailwind-merge";

import { sidebarLinks } from "@/constants";

function LeftSidebar() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    // Left sidebar on Desktop devices (Bottom-bar on Mobile devices)
    <section className="custom-scrollbar left-sidebar">
      <div className="w-full flex flex-1 flex-col gap-6 px-6">
        {sidebarLinks.map((link) => {
          // Active Link
          const isActive =
            (pathname.includes(link.route) && link.route.length > 1) ||
            pathname === link.route;

          return (
            <Link
              href={link.route}
              key={link.label}
              className={twMerge(
                "left-sidebar_link",
                isActive && "bg-primary-500"
              )}
            >
              <Image
                src={link.imgURL}
                alt={link.label}
                width={24}
                height={24}
              />
              <p className="text-light-1 max-lg:hidden">{link.label}</p>
            </Link>
          );
        })}
      </div>

      {/* Sign Out Button (only visible on large devices, will be on top-bar on small devices.) */}
      <div className="mt-10 px-6">
        <SignedIn>
          <SignOutButton signOutCallback={() => router.push("/sign-in")}>
            <div className="flex gap-4 p-4 cursor-pointer">
              <Image
                src="/assets/logout.svg"
                alt="logout"
                width={24}
                height={24}
              />
              <p className="text-light-2 max-lg:hidden">Logout</p>
            </div>
          </SignOutButton>
        </SignedIn>
      </div>
    </section>
  );
}

export default LeftSidebar;