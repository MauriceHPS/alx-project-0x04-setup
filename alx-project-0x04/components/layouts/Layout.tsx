import { ReactNode } from "react";
import Footer from "./Footer";
import Header from "./Header";
import { LayoutProps } from "@/interface";

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <>
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="grow bg-linear-to-r from-gray-300 to-gray-100">
          {children}
        </main>

        <Footer />
      </div>
    </>
  );
};

export default Layout;
