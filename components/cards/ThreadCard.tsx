import Image from "next/image";
import Link from "next/link";

interface ThreadCardProps {
  id: string;
  currentUserId: string;
  parentId: string | null;
  content: string;
  author: {
    id: string;
    username: string;
    image: string;
  };
  community: {
    id: string;
    name: string;
    image: string;
  } | null;
  createdAt: string;
  comments: {
    author: {
      image: string;
    };
  }[];
  isComment?: boolean;
}

const ThreadCard = ({
  id,
  currentUserId,
  parentId,
  content,
  author,
  community,
  createdAt,
  comments,
  isComment,
}: ThreadCardProps) => {
  return (
    <article className="w-full flex flex-col rounded-xl bg-dark-2 p-7">
      <div className="flex items-start justify-between">
        <div className="w-full flex flex-1 flex-row gap-4">
          {/* --------- Row --------- */}
          <div className="flex flex-col items-center">
            {/* Profile Image */}
            <Link href={`/profile/${author.id}`} className="relative w-11 h-11">
              <Image
                src={author.image}
                alt="profile image"
                fill
                className="rounded-full cursor-pointer"
              />
            </Link>

            {/* Threads Bar (extends) */}
            <div className="thread-card_bar" />
          </div>

          {/* --------- Row --------- */}
          <div className="w-full flex flex-col">
            {/* Author Name */}
            <Link href={`/profile/${author.id}`} className="w-fit">
              <h4 className="text-base-semibold text-light-1 cursor-pointer">
                {author.username}
              </h4>
            </Link>

            {/* Thread Content */}
            <p className="mt-2 text-small-regular text-light-2">{content}</p>

            {/* ---- Action Content ---- */}
            <div className="mt-5 flex flex-col gap-3">
              <div className="flex gap-3.5">
                {/* Like Button */}
                <Image
                  src="/assets/heart-gray.svg"
                  alt="heart"
                  width={24}
                  height={24}
                  className="object-contain cursor-pointer"
                />
                {/* Reply Button */}
                <Link href={`/thread/${id}`}>
                  <Image
                    src="/assets/reply.svg"
                    alt="reply"
                    width={24}
                    height={24}
                    className="object-contain cursor-pointer"
                  />
                </Link>
                {/* Repost Button */}
                <Image
                  src="/assets/repost.svg"
                  alt="repost"
                  width={24}
                  height={24}
                  className="object-contain cursor-pointer"
                />
                {/* Share Button */}
                <Image
                  src="/assets/share.svg"
                  alt="share"
                  width={24}
                  height={24}
                  className="object-contain cursor-pointer"
                />
              </div>

              {/* Comments Section */}
              {isComment && comments.length > 0 && (
                <Link href={`/thred/${id}`}>
                  <p className="mt-1 text-subtle-medium text-gray-1">
                    {comments.length} replies
                  </p>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};

export default ThreadCard;