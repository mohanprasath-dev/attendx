import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
        <p className="mb-4 text-sm uppercase tracking-[0.3em] text-slate-300">AttendX</p>
        <h1 className="max-w-3xl text-5xl font-semibold tracking-tight sm:text-7xl">
          Fraud-proof attendance for college events.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-slate-300">
          Dynamic QR codes, round-based check-ins, and certificate eligibility in one workflow.
        </p>
        <div className="mt-10 flex gap-4">
          <Link
            className="rounded-full bg-white px-6 py-3 text-sm font-medium text-slate-950 transition hover:bg-slate-200"
            href="/login"
          >
            Get started
          </Link>
        </div>
      </div>
    </main>
  );
}
