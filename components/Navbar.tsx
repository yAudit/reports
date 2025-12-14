/* eslint-disable @next/next/no-img-element */

import React, { useState } from "react";
import Link from "next/link";
import { CloseCircleOutlined, MenuOutlined } from "@ant-design/icons";

// Button component for consistent styling
function Button({ text }: { text: string }) {
  return (
    <button className="px-6 py-3 text-sm text-zinc-400 hover:text-deepblue hover:bg-white hover:bg-opacity-5 duration-700">
      {text}
    </button>
  );
}

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <nav className="w-full bg-white flex h-18 items-center justify-between top-0 py-6">
        {/* Logo section */}
        <div className="lg:ml-[19vw] ml-4">
          <Link href="https://yaudit.dev/">
            <img alt="Logo" src="/logo.svg" className="h-10" />
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          className="px-8 py-3 lg:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <MenuOutlined />
        </button>

        {/* Desktop menu */}
        <div className="hidden lg:flex flex-row items-center lg:mr-[19vw]">
          <Link href="https://reports.yaudit.dev/">
            <button className="px-4 py-3 text-sm hover:text-deepblue text-bold text-deepblue duration-700">
              Reports
            </button>
          </Link>
          <Link href="https://blog.yaudit.dev/">
            <Button text="Blog" />
          </Link>
          <Link href="https://research.yaudit.dev/">
            <Button text="Research" />
          </Link>
          <Link href="https://yaudit.dev/fellowships">
            <Button text="Fellowships" />
          </Link>
          <Link href="https://yaudit.dev/services">
            <Button text="Services" />
          </Link>
          <Link href="https://yaudit.dev/team">
            <Button text="Team" />
          </Link>
          <Link href="https://yaudit.dev/contact-us">
            <button className="px-8 py-3 text-md bg-deepblue text-white hover:bg-white hover:text-deepblue hover:border hover:border-deepblue duration-700">
              Contact
            </button>
          </Link>
        </div>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="w-full bg-white h-full z-40 duration-700">
          <div className="pt-8 mx-auto flex flex-col p-8 gap-2">
            <button
              onClick={() => setMenuOpen(false)}
              className="text-deepblue"
            >
              <CloseCircleOutlined style={{ fontSize: "2rem" }} />
            </button>

            <Link href="https://reports.yaudit.dev/">
              <button className="p-6 w-full text-xl text-zinc-400 hover:text-deepblue hover:bg-white hover:bg-opacity-5 duration-700">
                Reports
              </button>
            </Link>
            <Link href="https://blog.yaudit.dev/">
              <button className="p-6 w-full text-xl text-deepblue hover:bg-white hover:bg-opacity-5 duration-700">
                Blog
              </button>
            </Link>
            <Link href="https://research.yaudit.dev/">
              <button className="p-6 w-full text-xl text-deepblue hover:bg-white hover:bg-opacity-5 duration-700">
                Research
              </button>
            </Link>
            <Link href="https://yaudit.dev/fellowships">
              <button
                onClick={() => setMenuOpen(false)}
                className="p-6 w-full text-xl text-zinc-400 hover:text-deepblue hover:bg-white hover:bg-opacity-5 duration-700"
              >
                Fellowships
              </button>
            </Link>
            <Link href="https://yaudit.dev/services">
              <button
                onClick={() => setMenuOpen(false)}
                className="p-6 w-full text-xl text-zinc-400 hover:text-deepblue hover:bg-white hover:bg-opacity-5 duration-700"
              >
                Services
              </button>
            </Link>
            <Link href="https://yaudit.dev/team">
              <button
                onClick={() => setMenuOpen(false)}
                className="p-6 w-full text-xl text-zinc-400 hover:text-deepblue hover:bg-white hover:bg-opacity-5 duration-700"
              >
                Team
              </button>
            </Link>
            <Link href="https://yaudit.dev/contact-us">
              <button
                onClick={() => setMenuOpen(false)}
                className="p-6 w-full text-xl text-deepblue text-bold hover:bg-white hover:bg-opacity-5 duration-700"
              >
                Contact
              </button>
            </Link>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
