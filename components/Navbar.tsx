/* eslint-disable @next/next/no-img-element */

import React, { useState } from "react";
import Link from "next/link";
import { CloseCircleOutlined, MenuOutlined } from "@ant-design/icons";

// Button component for consistent styling
function Button({ text }: { text: string }) {
  return (
    <button className="px-6 py-3 rounded-xl text-sm text-zinc-400 hover:text-emeraldlight hover:bg-white hover:bg-opacity-5 duration-700">
      {text}
    </button>
  );
}

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <nav className="w-full bg-white flex h-18 items-center justify-between top-0 p-6">
        {/* Logo section */}
        <div className="flex flex-row gap-4 text-emeraldlight items-center text-xl lg:ml-36">
          <Link href="https://electisec.tech/">
            <img alt="Logo" src="/logo.svg" className="h-10" />
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          className="px-8 py-3 rounded-xl lg:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <MenuOutlined />
        </button>

        {/* Desktop menu */}
        <div className="hidden lg:flex flex-row items-center gap-1 lg:mr-[8vw]">
          <Link href="https://electisec.tech/members">
            <Button text="Members" />
          </Link>
          <Link href="https://reports.electisec.tech/">
            <button className="px-6 py-3 rounded-xl text-sm hover:text-darkgreen text-bold text-emeraldlight duration-700">
              Reports
            </button>
          </Link>
          <Link href="https://blog.electisec.tech/">
            <Button text="Blog" />
          </Link>
          <Link href="https://electisec.tech/fellowships">
            <Button text="Fellowships" />
          </Link>
          <Link href="https://electisec.tech/services">
            <Button text="Services" />
          </Link>
          <Link href="https://electisec.tech/contact-us">
            <button className="px-8 py-3 rounded-xl text-md text-darkgreen text-bold bg-emeraldlight bg-opacity-25 hover:bg-opacity-5 hover:text-emeraldlight duration-700">
              Contact Us
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
              className="text-green-400"
            >
              <CloseCircleOutlined style={{ fontSize: "2rem" }} />
            </button>
            <Link href="https://electisec.tech/members">
              <button
                onClick={() => setMenuOpen(false)}
                className="p-6 rounded-xl w-full text-xl text-zinc-400 hover:text-emeraldlight hover:bg-white hover:bg-opacity-5 duration-700"
              >
                Members
              </button>
            </Link>
            <Link href="https://reports.electisec.tech/">
              <button className="p-6 rounded-xl w-full text-xl text-zinc-400 hover:text-emeraldlight hover:bg-darkgreen hover:bg-opacity-5 duration-700">
                Reports
              </button>
            </Link>
            <Link href="https://blog.electisec.tech/">
              <button className="p-6 rounded-xl w-full text-xl text-emeraldlight hover:bg-darkgreen hover:bg-opacity-5 duration-700">
                Blog
              </button>
            </Link>
            <Link href="https://electisec.tech/fellowships">
              <button
                onClick={() => setMenuOpen(false)}
                className="p-6 rounded-xl w-full text-xl text-zinc-400 hover:text-emeraldlight hover:bg-darkgreen hover:bg-opacity-5 duration-700"
              >
                Fellowships
              </button>
            </Link>
            <Link href="https://electisec.tech/services">
              <button
                onClick={() => setMenuOpen(false)}
                className="p-6 rounded-xl w-full text-xl text-zinc-400 hover:text-emeraldlight hover:bg-white hover:bg-opacity-5 duration-700"
              >
                Services
              </button>
            </Link>
            <Link href="https://electisec.tech/contact-us">
              <button
                onClick={() => setMenuOpen(false)}
                className="p-6 rounded-xl w-full text-xl text-emeraldlight text-bold hover:bg-darkgreen hover:bg-opacity-5 duration-700"
              >
                Contact Us
              </button>
            </Link>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
