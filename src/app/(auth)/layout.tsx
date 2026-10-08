import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-6 text-2xl font-extrabold text-brand-700">
        ÉcoleFacile <span className="text-gray-900">RDC</span>
      </Link>
      {children}
    </main>
  );
}
