import "./globals.css";

export const metadata = {
  title: "PulseGrid",
  description: "Live parallel check-ins on Monad Testnet",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
