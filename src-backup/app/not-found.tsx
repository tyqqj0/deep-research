"use client";
import Link from "next/link";

function NotFound() {
  return (
    <div>
      <h2>404 Not Found</h2>
      <p>There is nothing here...</p>
      <Link href="/">Return Home</Link>
    </div>
  );
}

export default NotFound;
