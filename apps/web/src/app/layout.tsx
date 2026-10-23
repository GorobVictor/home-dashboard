import type { Metadata } from "next";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Home Dashboard",
  description: "Private dashboard for your home",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="uk" className="dark dashboard-theme h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground"><TooltipProvider>{children}<Toaster theme="dark" /></TooltipProvider></body>
    </html>
  );
}
