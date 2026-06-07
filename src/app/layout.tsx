import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Lucke Inventory",
  description: "在庫管理と棚卸しをスマートに。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <AuthProvider>
          <Navbar />
          <main className="main-container" style={{ minHeight: 'calc(100vh - 150px)' }}>
            <ProtectedRoute>
              {children}
            </ProtectedRoute>
          </main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
